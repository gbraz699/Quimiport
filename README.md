# QuimiPort

## Sistema de Gestão de Cargas Químicas Portuárias

O **QuimiPort** é um sistema voltado ao gerenciamento de cargas químicas em ambientes portuários. A aplicação centraliza informações sobre produtos, cargas, documentos, responsáveis técnicos, inspeções e situação operacional, facilitando o controle de liberação, bloqueio e movimentação.

## Fase 2 — aplicação implementada

A Fase 2 transforma a concepção do domínio em uma API REST para cadastrar produtos químicos, registrar cargas e controlar seu status. O foco é reduzir a dispersão das informações operacionais e impedir registros ou transições que contrariem as regras do domínio. Documentos e inspeções aparecem na concepção da Fase 1; nesta entrega, a documentação da carga é representada pelo campo booleano `documentacaoObrigatoria`, e não há cadastro separado de documentos ou inspeções.

### Funcionalidades e arquitetura

- Produtos químicos: cadastro, consulta, atualização e inativação lógica.
- Cargas químicas: registro, consulta, bloqueio, liberação, cancelamento e alteração de status. Uma carga nova começa em `REGISTRADA` e exige produto existente e ativo, código único, quantidade positiva e responsável técnico.
- Persistência em PostgreSQL com migrations Prisma, respostas de erro padronizadas, logs e documentação OpenAPI navegável.

O código separa `domain` (entidades, contratos e máquina de estados), `application` (casos de uso), `infrastructure` (Prisma, PostgreSQL e logger), `interfaces` (rotas, controllers, validação, middlewares e Swagger) e `shared` (código compartilhado). O domínio não depende do Prisma; as regras de transição ficam em um único serviço de domínio.

### Tecnologias e estrutura

Node.js 24, TypeScript, Express, PostgreSQL 16, Prisma 7, Swagger/OpenAPI, Docker, Docker Compose, GitHub Actions e Node Test Runner. Os testes HTTP usam `fetch` e PostgreSQL real.

```text
src/
  domain/
  application/
  infrastructure/
  interfaces/
  shared/
  generated/prisma/
prisma/                 # schema e migrations
tests/                  # integração e suporte aos testes
.github/workflows/      # CI
Dockerfile
compose.yml
```

### Dados e fluxo de status

O PostgreSQL mantém **Produto Químico 1:N Carga Química**. Produto contém `id`, `nome`, `classeRisco`, `status`, datas de criação e atualização, além de `descricao`, `numeroOnu` e `grupoCompatibilidade` opcionais. A inativação muda o status para `INATIVO`, sem excluir o registro.

Carga contém `id`, `codigo` único, `produtoQuimicoId`, `quantidade` decimal com precisão, `unidadeMedida`, `origem`, `destino`, `responsavelTecnico`, `documentacaoObrigatoria`, `status`, `dataEntrada` e datas de criação e atualização. A quantidade é representada como texto decimal na API. O Prisma gerencia o schema e as migrations.

Os oito status são `REGISTRADA`, `EM_ANALISE`, `EM_INSPECAO`, `LIBERADA`, `BLOQUEADA`, `EM_MOVIMENTACAO`, `FINALIZADA` e `CANCELADA`.

Fluxo principal: `REGISTRADA → EM_ANALISE → EM_INSPECAO → LIBERADA → EM_MOVIMENTACAO → FINALIZADA`.

Alternativas permitidas: `REGISTRADA → CANCELADA`; `EM_ANALISE → CANCELADA`; `EM_INSPECAO → BLOQUEADA` ou `CANCELADA`; `LIBERADA → CANCELADA`; `BLOQUEADA → CANCELADA`. `FINALIZADA` e `CANCELADA` são terminais. A liberação a partir de `EM_INSPECAO` exige `documentacaoObrigatoria === true`. Qualquer outra transição é rejeitada.

### API e Swagger

| Recurso | Endpoints |
| --- | --- |
| Health | `GET /health` |
| Produtos | `POST /produtos-quimicos`, `GET /produtos-quimicos`, `GET /produtos-quimicos/:id`, `PUT /produtos-quimicos/:id`, `PATCH /produtos-quimicos/:id/inativar` |
| Cargas | `POST /cargas-quimicas`, `GET /cargas-quimicas`, `GET /cargas-quimicas/:id`, `PATCH /cargas-quimicas/:id/status`, `PATCH /cargas-quimicas/:id/bloquear`, `PATCH /cargas-quimicas/:id/liberar`, `PATCH /cargas-quimicas/:id/cancelar` |

Os contratos completos, exemplos, enums e respostas de erro estão em [Swagger UI](http://localhost:3000/api/docs). A especificação está em `http://localhost:3000/api/docs/openapi.json`.

### Variáveis de ambiente e execução local

Copie `.env.example` para `.env` e ajuste `DATABASE_URL` para um PostgreSQL acessível. `PORT` define a porta da API (padrão `3000`) e `NODE_ENV` define o ambiente. Não use credenciais de produção no arquivo local. A execução fora do Docker requer PostgreSQL disponível em `localhost:5432` ou na URL escolhida.

```sh
npm ci
npx prisma generate
npx prisma migrate deploy
npm run build
npm start
```

Para desenvolvimento, após configurar o banco e gerar o Prisma Client, use `npm run dev`.

### Execução com Docker

```sh
docker compose -f compose.yml up -d --build
docker compose -f compose.yml ps
docker compose -f compose.yml logs api
docker compose -f compose.yml down
```

O Compose sobe `db` (PostgreSQL 16) e `api`. A API responde em `http://localhost:3000`; o banco usa a rede interna do Compose e não publica a porta `5432` no host. Um volume nomeado preserva os dados ao executar `down`. O banco possui healthcheck; após ficar saudável, a API executa `prisma migrate deploy` antes de iniciar. A execução Docker foi validada com PostgreSQL saudável, migration aplicada, `/health` e Swagger acessíveis.

### Testes, erros e logs

```sh
npm test
npm run test:coverage
npm run typecheck
npm run build
npx prisma validate
```

Há 87 testes automatizados cobrindo produtos, cargas, regras e concorrência de status, erros, health, Swagger e integração com PostgreSQL. As suítes de integração criam schemas temporários e os removem ao final, sem deixar dados no schema `public`. `test:coverage` usa a cobertura nativa do Node, sem meta percentual arbitrária.

Erros da API usam o formato abaixo. Dados inválidos retornam `400`; recurso ausente, `404`; conflito de regra de negócio, `409`; falha inesperada, `500`.

```json
{
  "error": {
    "code": "CODIGO_DO_ERRO",
    "message": "Descrição do erro."
  }
}
```

O logger registra requisições HTTP, criação de produto, registro de carga, mudanças de status, bloqueio, liberação, cancelamento e erros. Logs comuns são reduzidos durante os testes.

### Integração contínua

O workflow [`.github/workflows/ci.yml`](.github/workflows/ci.yml) roda em push para `main` e pull request direcionado a `main`. Ele instala dependências com `npm ci`, inicia PostgreSQL 16 descartável, executa `prisma generate`, `prisma validate`, `prisma migrate deploy`, typecheck, build e testes. A entrega inclui CI; não há deploy automático.

### Decisões e escopo da entrega

TypeScript e Express compõem a API; PostgreSQL e Prisma fornecem persistência e migrations. A separação por camadas mantém as regras no domínio, incluindo a máquina de estados. Swagger documenta o contrato; Docker Compose reproduz a execução local; GitHub Actions verifica o projeto a cada mudança em `main`.

Foram entregues API Node.js, Produto Químico, Carga Química, regras de negócio, persistência PostgreSQL, migrations, Swagger, logs, erros padronizados, testes, Docker e CI. Interface web, cadastro próprio de documentos e inspeções, autenticação e deploy de produção permanecem para evolução futura.

## Fase 1 — concepção do domínio

As seções seguintes preservam o contexto, a linguagem ubíqua, a modelagem e as decisões originais. Elas descrevem a concepção do sistema, incluindo elementos ainda não implementados. Em caso de diferença, a seção **Fase 2 — aplicação implementada** descreve o comportamento atual da API.

## Navegação da Documentação

1. Contexto, problema e objetivo
2. Domínio do sistema
3. Linguagem ubíqua
4. Modelagem do domínio
5. Casos de uso
6. Regras de negócio
7. Arquitetura proposta
8. Organização do projeto
9. Diagramas
10. Plano de qualidade de software
11. Uso de JavaScript e TypeScript
12. Decisões arquiteturais
13. Roadmap de evolução

## Contexto, Problema e Objetivo

### Contexto

A movimentação de produtos químicos em portos exige controle cuidadoso por envolver riscos, documentação obrigatória, responsáveis técnicos e etapas de validação.

Quando essas informações ficam espalhadas entre planilhas, documentos físicos ou sistemas diferentes, a consulta se torna mais difícil e aumenta o risco de erros operacionais.

### Problema

A falta de um controle centralizado dificulta identificar se uma carga está regular, possui pendências ou precisa ser bloqueada antes de continuar no processo portuário.

### Objetivo

O objetivo do QuimiPort é apoiar o acompanhamento das cargas químicas por meio do registro de produtos, cargas, documentos, inspeções, responsáveis e status, aplicando regras que impeçam movimentações quando as condições necessárias não forem atendidas.

## Domínio do Sistema

O domínio está relacionado ao ciclo de uma carga química, desde o registro até sua liberação, bloqueio, movimentação, finalização ou cancelamento.

### Usuários

• **Operador portuário:** acompanha as cargas e suas condições operacionais.  
• **Responsável técnico:** realiza o acompanhamento técnico.  
• **Analista de documentação:** verifica os documentos necessários.  
• **Analista de qualidade:** acompanha conformidades e inspeções.  
• **Gestor operacional:** supervisiona o fluxo das cargas.  
• **Administrador:** gerencia usuários e configurações.

### Informações Controladas

Produtos químicos, classe de risco, cargas, quantidade, responsáveis técnicos, documentos, inspeções, status, bloqueios, liberações e histórico.

### Processos Principais

Cadastro de produtos, registro de cargas, associação com produto e responsável, validação de documentos, inspeção, atualização de status, bloqueio, liberação, cancelamento e consulta de histórico.

### Restrições

Produtos inativos não podem ser usados em novas cargas. Informações obrigatórias não podem estar ausentes. A quantidade deve ser maior que zero, toda carga deve possuir responsável técnico e as operações devem respeitar o status atual.

## Linguagem Ubíqua

• **Produto Químico:** produto cadastrado que pode ser associado a uma carga.  
• **Carga Química:** registro operacional de uma carga contendo produto químico.  
• **Classe de Risco:** classificação usada para indicar o risco do produto.  
• **Responsável Técnico:** profissional vinculado à carga.  
• **Documento da Carga:** documento necessário para validação e acompanhamento.  
• **Inspeção:** verificação das condições da carga.  
• **Status da Carga:** situação atual no fluxo operacional.  
• **Bloqueio:** condição que impede a continuidade da carga.  
• **Liberação:** autorização para a carga seguir no fluxo.  
• **Histórico:** registro das alterações e eventos importantes.

## Modelagem do Domínio

### Entidades

#### Produto Químico
**Responsabilidade:** representar um produto que pode ser utilizado em cargas.  
**Atributos:** identificador, nome, classe de risco, descrição e situação de atividade.  
**Relacionamento:** pode ser associado a várias cargas.

#### Carga Química
**Responsabilidade:** representar a carga acompanhada no processo portuário.  
**Atributos:** identificador, produto, quantidade, responsável técnico, status e data de registro.  
**Relacionamentos:** produto, responsável técnico, documentos, inspeções e histórico.

#### Responsável Técnico
**Responsabilidade:** representar o profissional responsável pelo acompanhamento técnico.  
**Atributos:** identificador, nome, registro profissional e contato.  
**Relacionamento:** pode acompanhar várias cargas.

#### Documento da Carga
**Responsabilidade:** representar um documento vinculado a uma carga.  
**Atributos:** identificador, tipo, situação, data e referência do arquivo.  
**Relacionamento:** pertence a uma carga.

#### Inspeção
**Responsabilidade:** registrar uma verificação realizada sobre a carga.  
**Atributos:** identificador, data, resultado e observações.  
**Relacionamento:** pertence a uma carga.

#### Área de Armazenamento
**Responsabilidade:** representar o local onde as cargas podem ser armazenadas.  
**Atributos:** identificador, nome ou código, localização e situação operacional.  
**Relacionamento:** pode armazenar várias cargas.

### Objetos de Valor

**Classe de Risco:** indica o risco associado ao produto químico.  
**Quantidade da Carga:** guarda valor e unidade de medida, com valor maior que zero.  
**Status da Carga:** representa estados como registrada, em validação, bloqueada, liberada, finalizada ou cancelada.  
**Status do Documento:** indica se o documento está pendente, válido ou inválido.  
**Resultado da Inspeção:** indica se a inspeção foi aprovada, reprovada ou ficou pendente de correção.

### Agregado Principal

A **Carga Química** é o principal agregado do sistema, pois concentra produto associado, quantidade, responsável, documentos, inspeções, status, bloqueios, liberações e histórico.

Produto Químico e Responsável Técnico possuem existência própria. Documentos e inspeções ficam ligados ao contexto da carga.

O agregado deve impedir mudanças de status, bloqueios ou liberações que não respeitem as regras do domínio.

## Casos de Uso

### Cadastrar Produto Químico
**Ator:** administrador ou usuário autorizado.  
**Entrada:** nome, classe de risco, descrição e situação inicial.  
**Saída:** produto registrado.

### Inativar Produto Químico
**Ator:** administrador ou usuário autorizado.  
**Entrada:** identificador do produto.  
**Saída:** produto inativado.

### Registrar Carga Química
**Ator:** operador portuário.  
**Entrada:** produto, quantidade e responsável técnico.  
**Saída:** carga registrada.

### Validar Documentação
**Ator:** analista de documentação.  
**Entrada:** carga, documentos e situação de cada documento.  
**Saída:** documentação válida, inválida ou pendente.

### Solicitar Inspeção
**Ator:** operador, analista de qualidade ou gestor operacional.  
**Entrada:** carga e motivo da inspeção.  
**Saída:** inspeção vinculada à carga.

### Liberar Carga
**Ator:** responsável técnico ou usuário autorizado.  
**Entrada:** identificador da carga.  
**Saída:** carga liberada quando estiver regular.

### Bloquear Carga
**Ator:** responsável técnico, analista de qualidade ou gestor operacional.  
**Entrada:** carga e motivo do bloqueio.  
**Saída:** carga bloqueada.

### Atualizar Status
**Ator:** usuário autorizado.  
**Entrada:** carga e novo status.  
**Saída:** status atualizado e registrado.

### Cancelar Carga
**Ator:** gestor operacional ou usuário autorizado.  
**Entrada:** carga e motivo do cancelamento.  
**Saída:** carga cancelada.

### Consultar Cargas por Status
**Ator:** usuário autorizado.  
**Entrada:** status desejado.  
**Saída:** lista de cargas filtradas.

### Consultar Histórico
**Ator:** usuário autorizado.  
**Entrada:** identificador da carga.  
**Saída:** histórico da carga.

## Regras de Negócio

### Produto Químico
• Deve possuir nome e classe de risco.  
• Produto inativo não pode ser usado em novas cargas.  
• A inativação não apaga o histórico de cargas existentes.

### Registro de Carga
• Deve possuir produto ativo, quantidade maior que zero e responsável técnico.  
• A classificação de risco deve estar associada ao produto.

### Documentação
• Documentos obrigatórios devem estar válidos antes da liberação.  
• Documentos pendentes ou inválidos podem impedir a continuidade da carga.

### Inspeção
• Toda inspeção deve estar ligada a uma carga.  
• Inspeção pendente ou reprovada impede liberação enquanto a pendência existir.

### Bloqueio, Liberação e Status
• Carga bloqueada não pode entrar em movimentação.  
• Carga cancelada não pode ser liberada.  
• Mudanças de status devem seguir o fluxo definido.  
• Bloqueios, liberações e alterações importantes devem ser registrados no histórico.

## Arquitetura Proposta

A arquitetura será organizada em quatro camadas simples.

**Interface:** recebe dados e encaminha as ações.  
**Aplicação:** executa os casos de uso.  
**Domínio:** concentra entidades, objetos de valor, agregados e regras de negócio.  
**Infraestrutura:** cuida de banco de dados, arquivos e serviços externos.

Essa divisão ajuda a evitar que mudanças técnicas afetem diretamente as regras principais do sistema.

## Organização do Projeto

Esta é a organização proposta na Fase 1. A árvore da aplicação implementada está na seção **Tecnologias e estrutura** da Fase 2.

```text
src
    domain
        entities
        value_objects
        aggregates
        repositories

    application
        use_cases
        dto
        errors

    infrastructure
        database
        repositories
        storage
        services

    interfaces
        controllers
        routes
        middlewares

    shared
        types
        utils
```

**domain:** regras e conceitos do negócio.  
**application:** casos de uso e estruturas de entrada e saída.  
**infrastructure:** banco, arquivos e integrações.  
**interfaces:** rotas, controllers e pontos de entrada.  
**shared:** tipos e funções reutilizáveis.

## Diagramas

### Diagrama de Domínio

A **Carga Química** é o elemento central do domínio. Ela se relaciona com Produto Químico, Responsável Técnico, Documento da Carga, Inspeção e Área de Armazenamento.

![Diagrama de Domínio](Diagrama%20de%20Domínio.png)

### Fluxo de Status da Carga Química

Este diagrama pertence à concepção da Fase 1. O fluxo implementado na API é o da seção **Dados e fluxo de status** da Fase 2; a imagem foi preservada como registro da modelagem inicial.

![Fluxo de Status](Fluxo%20de%20Status.png)

## Plano de Qualidade de Software

**Testes unitários:** quantidade, produto ativo, status permitido, objetos de valor e regras do agregado.  
**Testes de casos de uso:** registro de carga, documentação, inspeção, bloqueio, liberação, cancelamento e histórico.  
**Testes de integração:** comunicação entre casos de uso, repositórios, banco de dados e documentos.  
**Cenários críticos:** produto sem classe de risco, produto inativo, quantidade inválida, documentação incompleta, carga bloqueada e transição de status inválida.  
**Mocks:** podem simular repositórios, produtos, documentos, responsáveis e inspeções.

## Uso de JavaScript e TypeScript

O TypeScript será usado para deixar dados e contratos mais claros e reduzir erros.

**Tipagem forte:** representa status, classes de risco e dados dos casos de uso.  
**Interfaces:** definem contratos de repositórios, serviços e DTOs.  
**Classes:** podem representar entidades e agregados.  
**Enums:** podem representar valores fixos de status.  
**Funções puras:** ajudam em validações simples.  
**Async Await:** será usado em banco de dados, arquivos e integrações.  
**Generics:** podem ajudar em contratos reutilizáveis.  
**Tratamento de erros:** organiza situações como dados inválidos ou operação não permitida.

## Decisões Arquiteturais

1. Separar domínio, aplicação, interface e infraestrutura.
2. Manter as regras principais no domínio.
3. Usar TypeScript para melhorar clareza e segurança.
4. Usar contratos de repositório para reduzir dependência de tecnologias específicas.
5. Começar com uma arquitetura simples.
6. Permitir evolução para web, mobile e integrações.
7. Avaliar microsserviços apenas se houver necessidade futura.

## Roadmap de Evolução

**Etapa 1:** consolidar domínio, regras e fluxo de status.  
**Etapa 2:** implementar backend, API, banco de dados, documentos e histórico.  
**Etapa 3:** criar interface web para cadastro, consulta, validação, bloqueio e liberação.  
**Etapa 4:** adicionar autenticação e permissões por perfil.  
**Etapa 5:** adicionar integrações, notificações e auditoria.  
**Etapa 6:** avaliar aplicação mobile e painéis operacionais.
