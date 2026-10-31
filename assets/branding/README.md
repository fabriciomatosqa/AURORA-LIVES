# Identidade visual oficial AURORA

A logo oficial é a imagem original enviada pelo autor, **Emblema Triangular Neon Cristalino.png**, com 1254 × 1254 pixels e transparência RGBA. Não redesenhar, recriar, estilizar ou substituir a imagem por versões geradas.

## Arquivos utilizados

- `assets/branding/Emblema Triangular Neon Cristalino.png`: original preservado, em alta definição.
- `apps/desktop/public/aurora-mark.png`: cópia idêntica para todos os locais da interface, incluindo cabeçalhos, navegação e tela inicial.
- `apps/desktop/src-tauri/icons/source.png`: cópia idêntica usada pela CLI Tauri para produzir os ícones nativos Windows, Linux e Android.

O componente React `Crystal` deve continuar centralizando o uso da imagem na interface. O arquivo antigo `aurora-mark.webp` de 96 × 96 pixels foi substituído para evitar aparência desfocada.

`npm run test:brand` valida as três cópias e o checksum da imagem original; `npm run icons` valida e gera os formatos de ícones exigidos pelo Tauri. Os instaladores Windows (Inno Setup) e Linux (.deb) e o APK Android continuam usando essa mesma identidade visual.

Se o autor decidir alterar a marca no futuro, substituir conscientemente as três cópias e atualizar o checksum em `apps/desktop/scripts/verify-brand.mjs`.
