// db.js
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// Define o caminho para o arquivo de banco de dados (sqlite.db)
//__dirname é onde reside o script atual
//path normal: Projeto-TFinance/Projeto-TFinance/database/sqlite.js
//path com __dirname: Projeto-TFinance/Projeto-TFinance/database
//ou usa-se ./

const dbPath = path.resolve(__dirname, 'sqlite.db');

// Cria (ou abre) a conexão com o banco de dados
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Erro ao conectar ao banco de dados:', err.message);
  } else {
    console.log('Conectado ao banco de dados SQLite.');
  }
});

// Habilita as chaves estrangeiras
db.run("PRAGMA foreign_keys = ON;");

// Criação das tabelas (caso ainda não existam)
db.serialize(() => {
  // Tabela de usuários
  db.run(`
    CREATE TABLE IF NOT EXISTS user (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nome TEXT NOT NULL,
      email TEXT NOT NULL,
      senha TEXT NOT NULL,
      CHECK(LENGTH(email) <= 254),
      CHECK(LENGTH(senha) >= 3 AND LENGTH(senha) <= 60)
    );
  `, (err) => {
    if (err) console.error('Erro ao criar tabela user:', err.message);
  });

  //CHECK(LENGTH(senha) >= 10 AND LENGTH(senha) <= 60)
  
  // Tabela de lançamentos com referência para a tabela user (chave estrangeira)
  db.run(`
    CREATE TABLE IF NOT EXISTS lancamento (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      valor NUMERIC NOT NULL,
      data DATETIME DEFAULT (datetime('now')),
      descricao TEXT CHECK(descricao IS NULL OR LENGTH(descricao) <= 140),
      categoria_lancamento TEXT NOT NULL 
        CHECK(categoria_lancamento IN ('Alimentação', 'Despesas Pessoais', 'Fatura', 'Investimentos', 'Outros')),
      tipo_lancamento INTEGER NOT NULL 
        CHECK(tipo_lancamento IN (0, 1)),
      CHECK(valor >= 0 AND valor <= 999999999999999),
      FOREIGN KEY(user_id) REFERENCES user(id)
    );
  `, (err) => {
    if (err) console.error('Erro ao criar tabela lancamento:', err.message);
  });
});

// Função para o gráfico de pizza
function getPizzaChartData(userId, callback) {
  const query = `
    SELECT 
      CASE 
           WHEN tipo_lancamento = 0 THEN 'Receita'
           ELSE 'Despesa'
      END AS tipo,
      COUNT(*) AS quantidade,
      ROUND(COUNT(*) * 100.0 / (SELECT COUNT(*) FROM lancamento WHERE user_id = ?), 2) AS percentual
    FROM lancamento
    WHERE user_id = ?
    GROUP BY tipo_lancamento;
  `;
  db.all(query, [userId, userId], (err, rows) => {
    if (err) return callback(err);
    // Converte o resultado para um objeto com as porcentagens
    let data = { percentualReceitas: 0, percentualDespesas: 0 };
    rows.forEach(row => {
      if (row.tipo === 'Receita') data.percentualReceitas = row.percentual;
      else if (row.tipo === 'Despesa') data.percentualDespesas = row.percentual;
    });
    callback(null, data);
  });
}

// Função para o gráfico cartesiano
function getCartesianChartData(userId, callback) {
  const query = `
    SELECT
      date(data) AS data_lancamento,
      SUM(CASE WHEN tipo_lancamento = 0 THEN valor ELSE 0 END) AS total_receitas,
      SUM(CASE WHEN tipo_lancamento = 1 THEN valor ELSE 0 END) AS total_despesas,
      ROUND(AVG(valor), 2) AS media_lancamento
    FROM lancamento
    WHERE user_id = ?
    GROUP BY date(data)
    ORDER BY date(data);
  `;
  db.all(query, [userId], (err, rows) => {
    if (err) {
      console.error('Erro na consulta do gráfico cartesiano:', err.message);
      return callback(err);
    }
    callback(null, rows);
  });
}

// Função para o gráfico numérico
function getNumericChartData(userId, callback) {
  const query = `
    SELECT
      '+R$ ' || printf('%.2f', SUM(CASE WHEN tipo_lancamento = 0 THEN valor ELSE 0 END)) AS total_receitas,
      '-R$ ' || printf('%.2f', SUM(CASE WHEN tipo_lancamento = 1 THEN valor ELSE 0 END)) AS total_despesas
    FROM lancamento
    WHERE user_id = ?;
  `;
  db.get(query, [userId], (err, row) => {
    if (err) return callback(err);
    row = row || { total_receitas: 0, total_despesas: 0 };
    const saldoGeral = row.total_receitas - row.total_despesas;
    const data = {
      totalReceitas: parseFloat(row.total_receitas),
      totalDespesas: parseFloat(row.total_despesas),
      saldoGeral: saldoGeral
    };
    callback(null, data);
  });
}

module.exports = {
  db,
  getPizzaChartData,
  getCartesianChartData,
  getNumericChartData,
};
