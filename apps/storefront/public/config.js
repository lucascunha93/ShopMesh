// Configuração em tempo de execução. Em desenvolvimento fica vazia e o Vite usa
// VITE_API_URL; no container, o Nginx reescreve este arquivo a partir de SHOPMESH_API_URL.
window.SHOPMESH_API_URL = window.SHOPMESH_API_URL || '';
