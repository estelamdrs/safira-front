# Safira Front

Interface web desenvolvida para o TCC **Safira**, uma aplicação para organização inteligente de e-mails utilizando Gmail API e Modelos de Linguagem de Grande Escala (LLMs).

O sistema permite:

* Autenticação com Gmail
* Listagem de e-mails
* Análise automática de mensagens
* Comparação entre Gemini e Llama
* Aplicação de marcadores sugeridos
* Geração de respostas automáticas
* Coleta de feedback dos usuários sobre as análises realizadas

## Tecnologias utilizadas

* React
* Vite
* JavaScript
* CSS3
* Gmail API (via Safira API)

## Pré-requisitos

Antes de iniciar, instale:

* Node.js 20+ (recomendado)
* npm
* Git

## Clonando o repositório

```bash
git clone https://github.com/estelamdrs/safira-front.git
cd safira-front
```

## Instalando dependências

```bash
npm install
```

## Variáveis de ambiente

Crie um arquivo `.env` na raiz do projeto de acordo com o arquivo `.env.example`.

## Executando localmente

```bash
npm run dev
```

O sistema ficará disponível em:

```text
http://127.0.0.1:5173
```

## Fluxo de utilização

### 1. Conectar Gmail

Ao acessar o sistema:

1. Clique em **Conectar Gmail**
2. Faça login com sua conta Google
3. Autorize o acesso solicitado
4. Aguarde o retorno para a aplicação

### 2. Carregar e-mails

Após a autenticação:

1. Clique em **Listar e-mails**
2. Selecione um e-mail na lista lateral

### 3. Analisar o e-mail

O sistema disponibiliza duas abas:

* Gemini
* Llama

Selecione a aba desejada para visualizar a análise correspondente.

### 4. Aplicar marcador

Caso concorde com a classificação sugerida:

1. Clique em **Aplicar marcador**
2. O marcador será criado/aplicado automaticamente no Gmail

### 5. Avaliar classificação

Após a análise:

* Clique em **OK** se concordar com a categoria sugerida
* Clique em **Não** se discordar

### 6. Gerar resposta

Clique em:

```text
Sugerir resposta
```

O sistema gerará uma resposta automática baseada no conteúdo do e-mail.

### 7. Avaliar resposta sugerida

Após visualizar a resposta:

* Boa
* Média
* Ruim

**⚠️ Essas avaliações são registradas para fins de pesquisa do TCC.**

## Estrutura do projeto

```text
src/
├── components/
├── services/
├── assets/
├── App.jsx
├── App.css
└── main.jsx
```

## Integração com a API

A aplicação depende da execução do projeto:

```text
safira-api
```

Certifique-se de que a API esteja rodando antes de iniciar o front-end.

## Problemas comuns

### Erro ao conectar Gmail

Verifique:

* se a API está rodando;
* se a URL configurada em `VITE_API_BASE_URL` está correta;
* se o usuário foi autorizado no Google Cloud (caso o app esteja em modo de teste).

### Lista de e-mails vazia

Verifique:

* se a autenticação foi concluída;
* se existem mensagens na conta Gmail utilizada;
* se a API está retornando os dados corretamente.

### Erro ao utilizar Gemini

O Gemini possui limite de utilização.

Caso apareça:

```text
429 RESOURCE_EXHAUSTED
```

significa que a cota da API foi atingida.

### Erro ao utilizar Llama

Verifique se:

* o Ollama está rodando;
* a API está configurada corretamente.

## Ambiente utilizado para validação

### Backend

* Django
* Gmail API
* Gemini API
* Ollama (Llama 3.2)

### Frontend

* React
* Vite

## Autora

**Estela Medeiros**

Trabalho de Conclusão de Curso – Sistemas de Informação