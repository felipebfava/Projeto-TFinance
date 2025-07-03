const express = require('express');
const bodyParser = require('body-parser'); // Para parse de formulários e JSON

const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const authenticateToken = require('../middlewares/authenticateToken.js');
const cookieParser = require('cookie-parser');

const app = express();

app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

// Middleware para permitir o uso de cookies
app.use(cookieParser());

app.use(express.static(path.join(__dirname, '..')));

// Configuração do banco de dados SQLite
//const db = new sqlite3.Database('../database/sqlite.db');

const { db, getPizzaChartData, getCartesianChartData, getNumericChartData } = require('../database/sqlite.js');
db.once("open", () => console.log("Conectado ao sqlite"));

// Chave secreta para JWT (idealmente armazenada em VARIÁVEIS DE AMBIENTE)
const JWT_SECRET = process.env.JWT_SECRET || 'SUA_CHAVE_SECRETA';

// Configuração do EJS
app.set('views', path.join('./views'));
app.set('view engine', 'ejs');

/* --------------------
   LOGIN USUÁRIO

   felipe
   felipe@gmail.com
   Admin123
----------------------- */



/* --------------------
   ROTAS DE AUTENTICAÇÃO
----------------------- */

// Tela principal - GET exibe a tela Home
app.get('/v1/home', (req, res) => {
  res.render('home', { user: null });
});

// Tela de cadastro - GET
app.get('/v1/cadastro', (req, res) => {
  res.render('cadastro', { error: null });
});

// Cadastro - POST
app.post('/v1/cadastro', async (req, res) => {
  const { nome, email, senha, confirmSenha } = req.body;

  // Validações básicas
  if (!nome || !email || !senha || !confirmSenha) {
    return res.render('cadastro', { error: 'Todos os campos são obrigatórios.' });
  }
  if (senha !== confirmSenha) {
    return res.render('cadastro', { error: 'Senhas não conferem.' });
  }
  if (senha.length < 3) {
    //mudar para um tamanho mínimo aceitável
    return res.render('cadastro', { error: 'A senha deve ter no mínimo 3 caracteres.' });
  }

  try {
    // Criptografa a senha
    const hashedPassword = await bcrypt.hash(senha, 10);

    // Insere o usuário usando parâmetros para evitar SQL Injection
    const sql = `INSERT INTO user (nome, email, senha) VALUES (?, ?, ?)`;
    db.run(sql, [nome, email, hashedPassword], function (err) {
      if (err) {
        console.error(err);
        return res.render('cadastro', { error: 'Falha no cadastro. Tente novamente.' });
      }
      // Redireciona para a tela de login após o cadastro
      res.redirect('/v1/login');
    });
  } catch (error) {
    console.error("Erro ao criptografar a senha:", error);
    res.render('cadastro', { error: 'Erro interno. Tente novamente.' });
  }
});

// Tela de login - GET: exibe a tela de login
app.get('/v1/login', (req, res) => {
  res.render('login', { error: null });
});

// Login - POST: processa os dados de login
app.post('/v1/login', async (req, res) => {
  const { email, senha } = req.body;

  if (!email || !senha) {
    return res.status(400).json({ error: "Todos os campos são obrigatórios." });
  }

  const sql = `SELECT * FROM user WHERE email = ? LIMIT 1`;
  db.get(sql, [email], async (err, user) => {
    if (err) {
      console.error(err);
      return res.status(500).json({ error: "Erro no sistema. Tente novamente." });
    }

    if (!user) {
      return res.status(401).json({ error: "Usuário não cadastrado, faça login para entrar" });
    }

    const match = await bcrypt.compare(senha, user.senha);
    if (!match) {
      return res.status(401).json({ error: "Credenciais inválidas." });
    }

    // Gera um token JWT para autenticação; o token é enviado para o cliente salvo no localStorage (expira em 1h); 
    const token = jwt.sign({ id: user.id, email: user.email, nome: user.nome }, JWT_SECRET, { expiresIn: '1h' });

    //Gera o refresh token que expira em 7dias
    const refreshToken = jwt.sign({ id: user.id, email: user.email, nome: user.nome }, JWT_SECRET, { expiresIn: '7d' });

    // Envia o token como cookie HTTP-Only para evitar acesso via JavaScript
    res.cookie('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production', // só em produção usar https
      sameSite: 'strict',
      maxAge: 1000 * 60 * 60, // 1 hora
    });

    // retorna o token em formato JSON; o armazenamento local é feito no frontend
    res.json({ token, refreshToken, message: "Login realizado com sucesso." });
  });
});

/* --------------------
   ROTAS PROTEGIDAS (Exigem token JWT válido)
----------------------- */

// Tela de lançamentos - GET: Exibe os lançamentos do usuário
// authenticateToken,
app.get('/v1/lancamentos', authenticateToken, (req, res) => {
  console.log("Get Lançamentos");

  res.render('lancamentos', { user: req.user });
});

//authenticateToken,
app.post('/v1/lancamentos', authenticateToken, (req, res) => {
  const userId = req.user.id;
  const { valor, data, tipo, categoria, comentario } = req.body;

  console.log('Dados recebidos:', { valor, data, tipo, categoria, comentario });

  //campos obrigatórios
  if (!valor || !data || !tipo) {
    return res.status(400).json({ error: 'Os campos valor, data e tipo são obrigatórios.' });
  }

  // Validação do valor
  const valorNumerico = parseFloat(valor);
  if (isNaN(valorNumerico) || valorNumerico <= 0) {
    return res.status(400).json({ error: 'Valor deve ser um número maior que zero.' });
  }

  // Validação do tipo (deve ser exatamente "Receita" ou "Despesa")
  if (tipo !== 'Receita' && tipo !== 'Despesa') {
    return res.status(400).json({ error: 'Tipo deve ser "Receita" ou "Despesa".' });
  }

  // Mapeia o tipo para o formato do banco de dados
  const tipo_lancamento = tipo === 'Receita' ? 0 : 1; // 0 = Receita, 1 = Despesa


  // Mapeia o valor do frontend para os valores permitidos no banco de dados.
  let categoriaLancamento = 'Outros';
  if(categoria) {
    switch (categoria) {
    case 'Alimentacao':
      categoriaLancamento = 'Alimentação';
      break;
    case 'Investimento':
      categoriaLancamento = 'Investimentos';
      break;
    case 'Fatura':
      categoriaLancamento = 'Fatura';
      break;
    case 'DespesaCategoria':
      categoriaLancamento = 'Despesas Pessoais';
      break;
    case 'Outros':
      categoriaLancamento = 'Outros';
      break;
    default:
      categoriaLancamento = categoria;
    }
  }
  

  // Query para inserir o lançamento
  const sql = `
    INSERT INTO lancamento (user_id, valor, data, descricao, categoria_lancamento, tipo_lancamento)
    VALUES (?, ?, ?, ?, ?, ?)
  `;
  const params = [userId, valor, data, comentario || null, categoriaLancamento, tipo_lancamento];
  console.log('Inserindo no banco:', params);

  db.run(sql, params, function (err) {
    if (err) {
      console.error('Erro ao inserir lançamento:', err);
      return res.status(500).json({ error: 'Erro ao inserir lançamento no banco de dados.' });
    }

    console.log('Lançamento inserido com ID:', this.lastID);
    res.json({ message: 'Lançamento inserido com sucesso.', id: this.lastID });
  });
});

//authenticateToken,
// Tela Menu - GET: renderiza o menu.ejs
app.get('/v1/menu', (req, res) => {
  res.render('menu');
});

//authenticateToken,
// menu-data - GET: carrega os dados de saldo, lançamento e gráficos
app.get('/v1/menu-data', authenticateToken, (req, res) => {
  const userId = req.user.id;
  const sql = `SELECT id, valor, data, descricao as comentario,
  categoria_lancamento as categoria, tipo_lancamento,
  CASE
    WHEN tipo_lancamento = 0 THEN 'Receita'
    WHEN tipo_lancamento = 1 THEN 'Despesa' ELSE 'Indefinido'
  END as tipo
  FROM lancamento WHERE user_id = ? ORDER BY data DESC, id DESC`;

  db.all(sql, [userId], (err, lancamentos) => {
    if (err) {
      console.error('Erro ao buscar lançamentos:', err);
      return res.status(500).json({ error: 'Erro no banco de dados' });
    }

    console.log('Lançamentos encontrados:', lancamentos.length);
    console.log('Primeiro lançamento:', lancamentos[0]);

    // Em sequência, coleta os dados dos gráficos
    getPizzaChartData(userId, (err, pizzaData) => {
      if (err) {
        console.error('Erro no gráfico de pizza:', err);
        return res.status(500).json({ error: 'Erro no gráfico de pizza' });
      }

      getCartesianChartData(userId, (err, cartesianData) => {
        if (err) {
          console.error('Erro no gráfico cartesiano:', err);
          return res.status(500).json({ error: 'Erro no gráfico cartesiano' });
        }

        getNumericChartData(userId, (err, numericData) => {
          if (err) {
            console.error('Erro no gráfico numérico:', err);
            return res.status(500).json({ error: 'Erro no gráfico numérico' });
          }
          console.log('Dados numéricos:', numericData);
          
          res.json({
            user: req.user,
            lancamentos,
            pizzaData,
            cartesianData,
            numericData
          });
        });
      });
    });
  });
});


// Logout - Simplesmente retorna mensagem (a remoção do token fica no frontend)
app.post('/v1/logout', (req, res) => {
  // Limpa o cookie do token
  res.clearCookie('token', {
    path: '/',
  });

  res.json({ message: 'Logout realizado com sucesso.' });
});

// Refresh - Recebe refreshToken no corpo da requisição e, se válido, gera novo token de acesso
app.post('/v1/refresh', (req, res) => {
  const { refreshToken } = req.body;

  if (!refreshToken) return res.status(401).json({ error: 'Refresh token não fornecido.' });

  jwt.verify(refreshToken, JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ error: 'Refresh token inválido.' });

    // Gera novo access token - expira em 1h
    const newToken = jwt.sign({ id: user.id, email: user.email, nome: user.nome }, JWT_SECRET, { expiresIn: '1h' });

    res.json({ token: newToken, message: 'Token atualizado com sucesso.' });
  });
});

// Inicia o servidor
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Servidor rodando em: http://localhost:${PORT}/v1/home`);
});