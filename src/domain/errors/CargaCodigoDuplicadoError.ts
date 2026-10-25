export class CargaCodigoDuplicadoError extends Error {
  constructor() {
    super('Código de carga já cadastrado');
    this.name = 'CargaCodigoDuplicadoError';
  }
}
