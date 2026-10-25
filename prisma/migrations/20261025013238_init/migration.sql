-- CreateEnum
CREATE TYPE "ProdutoStatus" AS ENUM ('ATIVO', 'INATIVO');

-- CreateEnum
CREATE TYPE "CargaStatus" AS ENUM ('REGISTRADA', 'EM_ANALISE', 'EM_INSPECAO', 'LIBERADA', 'BLOQUEADA', 'EM_MOVIMENTACAO', 'FINALIZADA', 'CANCELADA');

-- CreateTable
CREATE TABLE "ProdutoQuimico" (
    "id" UUID NOT NULL,
    "nome" TEXT NOT NULL,
    "descricao" TEXT,
    "numeroOnu" TEXT,
    "classeRisco" TEXT NOT NULL,
    "grupoCompatibilidade" TEXT,
    "status" "ProdutoStatus" NOT NULL DEFAULT 'ATIVO',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProdutoQuimico_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CargaQuimica" (
    "id" UUID NOT NULL,
    "codigo" TEXT NOT NULL,
    "produtoQuimicoId" UUID NOT NULL,
    "quantidade" DECIMAL(14,3) NOT NULL,
    "unidadeMedida" TEXT NOT NULL,
    "origem" TEXT NOT NULL,
    "destino" TEXT NOT NULL,
    "responsavelTecnico" TEXT NOT NULL,
    "documentacaoObrigatoria" BOOLEAN NOT NULL DEFAULT false,
    "status" "CargaStatus" NOT NULL DEFAULT 'REGISTRADA',
    "dataEntrada" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CargaQuimica_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CargaQuimica_codigo_key" ON "CargaQuimica"("codigo");

-- CreateIndex
CREATE INDEX "CargaQuimica_produtoQuimicoId_idx" ON "CargaQuimica"("produtoQuimicoId");

-- AddForeignKey
ALTER TABLE "CargaQuimica" ADD CONSTRAINT "CargaQuimica_produtoQuimicoId_fkey" FOREIGN KEY ("produtoQuimicoId") REFERENCES "ProdutoQuimico"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
