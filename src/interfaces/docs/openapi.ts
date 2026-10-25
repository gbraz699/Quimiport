const schema = (name: string) => ({ $ref: `#/components/schemas/${name}` });
const response = (name: string) => ({ $ref: `#/components/responses/${name}` });
const idParameter = { $ref: '#/components/parameters/Id' };

const produtoExample = {
  id: '9f7f5396-5e3d-44bb-8428-1264d2241540',
  nome: 'Ácido Sulfúrico',
  descricao: 'Produto químico corrosivo',
  numeroOnu: 'UN1830',
  classeRisco: '8',
  grupoCompatibilidade: 'Corrosivos',
  status: 'ATIVO',
  createdAt: '2026-10-25T10:00:00.000Z',
  updatedAt: '2026-10-25T10:00:00.000Z',
};

const cargaExample = {
  id: 'b66f6280-b600-46d7-b558-40e947be45df',
  codigo: 'CARGA-001',
  produtoQuimicoId: produtoExample.id,
  quantidade: '1500.5',
  unidadeMedida: 'kg',
  origem: 'Santos',
  destino: 'Campinas',
  responsavelTecnico: 'Maria Silva',
  documentacaoObrigatoria: true,
  status: 'REGISTRADA',
  dataEntrada: '2026-10-25T10:00:00.000Z',
  createdAt: '2026-10-25T10:00:00.000Z',
  updatedAt: '2026-10-25T10:00:00.000Z',
  produtoQuimico: {
    id: produtoExample.id,
    nome: produtoExample.nome,
    numeroOnu: produtoExample.numeroOnu,
    classeRisco: produtoExample.classeRisco,
    status: produtoExample.status,
  },
};

const jsonResponse = (description: string, schemaName: string, example?: unknown) => ({
  description,
  content: {
    'application/json': {
      schema: schema(schemaName),
      ...(example === undefined ? {} : { example }),
    },
  },
});

const errorExample = (code: string, message: string) => ({ value: { error: { code, message } } });
const errorResponse = (description: string, examples: Record<string, ReturnType<typeof errorExample>>) => ({
  description,
  content: {
    'application/json': {
      schema: schema('ApiError'),
      examples,
    },
  },
});

const produtoResponse = jsonResponse('Produto químico.', 'ProdutoQuimico', produtoExample);
const cargaResponse = jsonResponse('Carga química com resumo do produto associado.', 'CargaQuimica', cargaExample);
const commonErrors = { '500': response('InternalError') };

export const openApiDocument = {
  openapi: '3.0.3',
  info: {
    title: 'QuimiPort API',
    version: '1.0.0',
    description: 'API REST para cadastro de produtos químicos, registro de cargas e controle do fluxo de status. A porta local padrão é 3000; a variável PORT pode alterá-la.',
  },
  servers: [{ url: 'http://localhost:3000', description: 'Servidor local na porta padrão' }],
  tags: [
    { name: 'Health', description: 'Estado da aplicação' },
    { name: 'Produtos Químicos', description: 'Cadastro e consulta de produtos químicos' },
    { name: 'Cargas Químicas', description: 'Registro, consulta e transições de status das cargas' },
  ],
  paths: {
    '/health': {
      get: {
        tags: ['Health'],
        summary: 'Verifica a disponibilidade da API',
        responses: {
          '200': { description: 'API disponível.', content: { 'application/json': { schema: { type: 'object', required: ['status'], properties: { status: { type: 'string', enum: ['ok'] } } }, example: { status: 'ok' } } } },
          ...commonErrors,
        },
      },
    },
    '/produtos-quimicos': {
      post: {
        tags: ['Produtos Químicos'],
        summary: 'Cadastra um produto químico',
        description: 'Produtos novos iniciam em ATIVO. Se status for informado, somente ATIVO é aceito; INATIVO gera conflito.',
        requestBody: { required: true, content: { 'application/json': { schema: schema('CreateProdutoQuimicoInput'), example: {
          nome: 'Ácido Sulfúrico', descricao: 'Produto químico corrosivo', numeroOnu: 'UN1830', classeRisco: '8', grupoCompatibilidade: 'Corrosivos',
        } } } },
        responses: { '201': produtoResponse, '400': response('BadRequest'), '409': response('ProdutoStatusInvalido'), ...commonErrors },
      },
      get: {
        tags: ['Produtos Químicos'], summary: 'Lista produtos químicos, inclusive inativos',
        responses: { '200': { description: 'Lista de produtos.', content: { 'application/json': { schema: { type: 'array', items: schema('ProdutoQuimico') }, example: [produtoExample] } } }, ...commonErrors },
      },
    },
    '/produtos-quimicos/{id}': {
      get: {
        tags: ['Produtos Químicos'], summary: 'Busca um produto químico por ID', parameters: [idParameter],
        responses: { '200': produtoResponse, '400': response('BadRequest'), '404': response('ProdutoNaoEncontrado'), ...commonErrors },
      },
      put: {
        tags: ['Produtos Químicos'], summary: 'Atualiza um produto químico', parameters: [idParameter],
        description: 'Nome e classe de risco são obrigatórios. Campos opcionais omitidos passam a null; status omitido é preservado.',
        requestBody: { required: true, content: { 'application/json': { schema: schema('UpdateProdutoQuimicoInput'), example: {
          nome: 'Ácido Sulfúrico Concentrado', classeRisco: '8', descricao: 'Produto químico corrosivo',
        } } } },
        responses: { '200': produtoResponse, '400': response('BadRequest'), '404': response('ProdutoNaoEncontrado'), ...commonErrors },
      },
    },
    '/produtos-quimicos/{id}/inativar': {
      patch: {
        tags: ['Produtos Químicos'], summary: 'Inativa um produto químico', parameters: [idParameter],
        description: 'Inativação lógica. Repetir a operação em um produto já inativo retorna o produto sem alterar seu registro.',
        responses: { '200': produtoResponse, '400': response('BadRequest'), '404': response('ProdutoNaoEncontrado'), ...commonErrors },
      },
    },
    '/cargas-quimicas': {
      post: {
        tags: ['Cargas Químicas'], summary: 'Registra uma carga química',
        description: 'O produto associado deve existir e estar ATIVO. A quantidade deve ser positiva. Toda carga inicia em REGISTRADA; status não é aceito na criação. documentacaoObrigatoria=false não impede o registro.',
        requestBody: { required: true, content: { 'application/json': { schema: schema('CreateCargaQuimicaInput'), example: {
          codigo: 'CARGA-001', produtoQuimicoId: produtoExample.id, quantidade: '1500.500', unidadeMedida: 'kg', origem: 'Santos', destino: 'Campinas', responsavelTecnico: 'Maria Silva', documentacaoObrigatoria: true, dataEntrada: '2026-10-25T10:00:00.000Z',
        } } } },
        responses: { '201': cargaResponse, '400': response('BadRequest'), '404': response('ProdutoNaoEncontrado'), '409': response('ConflitoCriacaoCarga'), ...commonErrors },
      },
      get: {
        tags: ['Cargas Químicas'], summary: 'Lista cargas com resumo do produto associado',
        responses: { '200': { description: 'Lista de cargas.', content: { 'application/json': { schema: { type: 'array', items: schema('CargaQuimica') }, example: [cargaExample] } } }, ...commonErrors },
      },
    },
    '/cargas-quimicas/{id}': {
      get: {
        tags: ['Cargas Químicas'], summary: 'Busca uma carga por ID', parameters: [idParameter],
        responses: { '200': cargaResponse, '400': response('BadRequest'), '404': response('CargaNaoEncontrada'), ...commonErrors },
      },
    },
    '/cargas-quimicas/{id}/status': {
      patch: {
        tags: ['Cargas Químicas'], summary: 'Altera o status de uma carga', parameters: [idParameter],
        description: 'Aceita apenas transições da matriz descrita em CargaStatus. Cargas FINALIZADA e CANCELADA não podem mudar. A liberação exige documentacaoObrigatoria=true.',
        requestBody: { required: true, content: { 'application/json': { schema: schema('UpdateCargaStatusInput'), example: { status: 'EM_ANALISE' } } } },
        responses: { '200': cargaResponse, '400': response('StatusInvalido'), '404': response('CargaNaoEncontrada'), '409': response('ConflitoStatus'), ...commonErrors },
      },
    },
    '/cargas-quimicas/{id}/bloquear': {
      patch: {
        tags: ['Cargas Químicas'], summary: 'Bloqueia uma carga', parameters: [idParameter],
        description: 'Somente EM_INSPECAO → BLOQUEADA. Carga já bloqueada não pode ser bloqueada novamente.',
        responses: { '200': cargaResponse, '400': response('BadRequest'), '404': response('CargaNaoEncontrada'), '409': response('TransicaoInvalida'), ...commonErrors },
      },
    },
    '/cargas-quimicas/{id}/liberar': {
      patch: {
        tags: ['Cargas Químicas'], summary: 'Libera uma carga', parameters: [idParameter],
        description: 'Somente EM_INSPECAO → LIBERADA, com documentacaoObrigatoria=true.',
        responses: { '200': cargaResponse, '400': response('BadRequest'), '404': response('CargaNaoEncontrada'), '409': response('ConflitoLiberacao'), ...commonErrors },
      },
    },
    '/cargas-quimicas/{id}/cancelar': {
      patch: {
        tags: ['Cargas Químicas'], summary: 'Cancela uma carga', parameters: [idParameter],
        description: 'Permitido a partir de REGISTRADA, EM_ANALISE, EM_INSPECAO, LIBERADA ou BLOQUEADA. Não é permitido a partir de EM_MOVIMENTACAO, FINALIZADA ou CANCELADA.',
        responses: { '200': cargaResponse, '400': response('BadRequest'), '404': response('CargaNaoEncontrada'), '409': response('TransicaoInvalida'), ...commonErrors },
      },
    },
  },
  components: {
    parameters: {
      Id: { name: 'id', in: 'path', required: true, description: 'ID UUID do recurso.', schema: { type: 'string', format: 'uuid' }, example: produtoExample.id },
    },
    schemas: {
      ProdutoStatus: { type: 'string', enum: ['ATIVO', 'INATIVO'] },
      CargaStatus: {
        type: 'string',
        enum: ['REGISTRADA', 'EM_ANALISE', 'EM_INSPECAO', 'LIBERADA', 'BLOQUEADA', 'EM_MOVIMENTACAO', 'FINALIZADA', 'CANCELADA'],
        description: [
          'Fluxo principal: REGISTRADA → EM_ANALISE → EM_INSPECAO → LIBERADA → EM_MOVIMENTACAO → FINALIZADA.',
          'Alternativas: REGISTRADA → CANCELADA; EM_ANALISE → CANCELADA; EM_INSPECAO → BLOQUEADA; EM_INSPECAO → CANCELADA; LIBERADA → CANCELADA; BLOQUEADA → CANCELADA.',
          'FINALIZADA e CANCELADA são terminais.',
        ].join('\n\n'),
      },
      ProdutoQuimico: {
        type: 'object', required: ['id', 'nome', 'descricao', 'numeroOnu', 'classeRisco', 'grupoCompatibilidade', 'status', 'createdAt', 'updatedAt'],
        properties: {
          id: { type: 'string', format: 'uuid' }, nome: { type: 'string' },
          descricao: { type: 'string', nullable: true }, numeroOnu: { type: 'string', nullable: true },
          classeRisco: { type: 'string' }, grupoCompatibilidade: { type: 'string', nullable: true },
          status: schema('ProdutoStatus'), createdAt: { type: 'string', format: 'date-time' }, updatedAt: { type: 'string', format: 'date-time' },
        },
        example: produtoExample,
      },
      CreateProdutoQuimicoInput: {
        type: 'object', additionalProperties: false, required: ['nome', 'classeRisco'],
        properties: {
          nome: { type: 'string', minLength: 1 }, descricao: { type: 'string', nullable: true }, numeroOnu: { type: 'string', nullable: true },
          classeRisco: { type: 'string', minLength: 1 }, grupoCompatibilidade: { type: 'string', nullable: true },
          status: { type: 'string', enum: ['ATIVO'], description: 'Opcional. Apenas ATIVO é aceito na criação; INATIVO retorna 409.' },
        },
      },
      UpdateProdutoQuimicoInput: {
        type: 'object', additionalProperties: false, required: ['nome', 'classeRisco'],
        properties: {
          nome: { type: 'string', minLength: 1 }, descricao: { type: 'string', nullable: true }, numeroOnu: { type: 'string', nullable: true },
          classeRisco: { type: 'string', minLength: 1 }, grupoCompatibilidade: { type: 'string', nullable: true }, status: schema('ProdutoStatus'),
        },
      },
      ProdutoResumido: {
        type: 'object', required: ['id', 'nome', 'numeroOnu', 'classeRisco', 'status'],
        properties: { id: { type: 'string', format: 'uuid' }, nome: { type: 'string' }, numeroOnu: { type: 'string', nullable: true }, classeRisco: { type: 'string' }, status: schema('ProdutoStatus') },
      },
      CargaQuimica: {
        type: 'object',
        required: ['id', 'codigo', 'produtoQuimicoId', 'quantidade', 'unidadeMedida', 'origem', 'destino', 'responsavelTecnico', 'documentacaoObrigatoria', 'status', 'dataEntrada', 'createdAt', 'updatedAt', 'produtoQuimico'],
        properties: {
          id: { type: 'string', format: 'uuid' }, codigo: { type: 'string' }, produtoQuimicoId: { type: 'string', format: 'uuid' },
          quantidade: { type: 'string', description: 'Decimal(14,3) positivo representado como texto. A saída pode remover zeros finais (1500.500 → 1500.5).', example: '1500.5' },
          unidadeMedida: { type: 'string' }, origem: { type: 'string' }, destino: { type: 'string' }, responsavelTecnico: { type: 'string' },
          documentacaoObrigatoria: { type: 'boolean' }, status: schema('CargaStatus'),
          dataEntrada: { type: 'string', format: 'date-time' }, createdAt: { type: 'string', format: 'date-time' }, updatedAt: { type: 'string', format: 'date-time' },
          produtoQuimico: schema('ProdutoResumido'),
        },
        example: cargaExample,
      },
      CreateCargaQuimicaInput: {
        type: 'object', additionalProperties: false,
        required: ['codigo', 'produtoQuimicoId', 'quantidade', 'unidadeMedida', 'origem', 'destino', 'responsavelTecnico'],
        description: 'status não é aceito. O valor inicial é sempre REGISTRADA.',
        properties: {
          codigo: { type: 'string', minLength: 1 }, produtoQuimicoId: { type: 'string', format: 'uuid' },
          quantidade: { type: 'string', pattern: '^\\d{1,11}(?:\\.\\d{1,3})?$', description: 'Decimal(14,3) maior que zero, em texto.', example: '1500.500' },
          unidadeMedida: { type: 'string', minLength: 1 }, origem: { type: 'string', minLength: 1 }, destino: { type: 'string', minLength: 1 },
          responsavelTecnico: { type: 'string', minLength: 1 }, documentacaoObrigatoria: { type: 'boolean', default: false },
          dataEntrada: { type: 'string', format: 'date-time', description: 'Opcional. Se omitida, usa a data e hora atual.' },
        },
      },
      UpdateCargaStatusInput: {
        type: 'object', additionalProperties: false, required: ['status'],
        properties: { status: schema('CargaStatus') }, example: { status: 'EM_ANALISE' },
      },
      ApiError: {
        type: 'object', required: ['error'],
        properties: { error: { type: 'object', required: ['code', 'message'], properties: { code: { type: 'string' }, message: { type: 'string' } } } },
        example: { error: { code: 'PRODUTO_NAO_ENCONTRADO', message: 'Produto químico não encontrado' } },
      },
    },
    responses: {
      BadRequest: errorResponse('Dados de entrada inválidos.', { dadosInvalidos: errorExample('INVALID_INPUT', 'Dados de entrada inválidos.') }),
      StatusInvalido: errorResponse('Status inexistente ou formato inválido.', { statusInvalido: errorExample('STATUS_INVALIDO', 'Status inválido') }),
      ProdutoNaoEncontrado: errorResponse('Produto químico não encontrado.', { produtoInexistente: errorExample('PRODUTO_NAO_ENCONTRADO', 'Produto químico não encontrado') }),
      CargaNaoEncontrada: errorResponse('Carga química não encontrada.', { cargaInexistente: errorExample('CARGA_NAO_ENCONTRADA', 'Carga química não encontrada') }),
      ProdutoInativo: errorResponse('Produto associado inativo.', { produtoInativo: errorExample('PRODUTO_INATIVO', 'Produto químico inativo') }),
      CodigoCargaDuplicado: errorResponse('Código de carga duplicado.', { codigoDuplicado: errorExample('CODIGO_CARGA_DUPLICADO', 'Código de carga já cadastrado') }),
      ProdutoStatusInvalido: errorResponse('Produto deve ser criado como ATIVO.', { produtoInativo: errorExample('PRODUTO_STATUS_INVALIDO', 'Produto deve ser criado como ATIVO') }),
      TransicaoInvalida: errorResponse('Transição de status não permitida.', { transicaoInvalida: errorExample('TRANSICAO_STATUS_INVALIDA', 'Transição de status não permitida') }),
      DocumentacaoAusente: errorResponse('Documentação obrigatória ausente.', { documentacaoAusente: errorExample('DOCUMENTACAO_AUSENTE', 'Documentação obrigatória ausente para liberação') }),
      ConflitoCriacaoCarga: errorResponse('Produto inativo ou código de carga já cadastrado.', {
        produtoInativo: errorExample('PRODUTO_INATIVO', 'Produto químico inativo'), codigoDuplicado: errorExample('CODIGO_CARGA_DUPLICADO', 'Código de carga já cadastrado'),
      }),
      ConflitoStatus: errorResponse('Transição não permitida ou documentação ausente.', {
        transicaoInvalida: errorExample('TRANSICAO_STATUS_INVALIDA', 'Transição de status não permitida'), documentacaoAusente: errorExample('DOCUMENTACAO_AUSENTE', 'Documentação obrigatória ausente para liberação'),
      }),
      ConflitoLiberacao: errorResponse('Carga fora de inspeção ou sem documentação.', {
        transicaoInvalida: errorExample('TRANSICAO_STATUS_INVALIDA', 'Transição de status não permitida'), documentacaoAusente: errorExample('DOCUMENTACAO_AUSENTE', 'Documentação obrigatória ausente para liberação'),
      }),
      InternalError: errorResponse('Erro interno genérico.', { erroInterno: errorExample('INTERNAL_ERROR', 'Erro interno do servidor.') }),
    },
  },
};
