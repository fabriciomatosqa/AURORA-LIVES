# AURORA LIVES — Teste de conexão M-Lab NDT7 (v0.0.30)

## Provedor único

Somente **Measurement Lab (M-Lab)** via cliente Rust NDT7 0.3.0 com WebSockets seguros. A descoberta HTTPS é feita explicitamente pelo cliente reqwest 0.12/rustls com raízes WebPKI, também utilizado pelo atualizador. A biblioteca NDT7 recebe URLs WSS explícitas e executa somente as transferências seguras; sua descoberta implícita não é chamada. A API oficial usada é `https://locate.measurementlab.net/v2/nearest/ndt/ndt7` e retorna URLs de servidor e token transitório. Não existe servidor HTTP personalizável, Cloudflare para velocidade nem serviço IPify. Não desabilitar TLS.

## Fluxo de execução

O comando Tauri em Rust transmite eventos `aurora:connection-progress` com etapas `locating`, `download`, `connecting-upload`, `upload` e `complete`. A interface se inscreve ANTES de invocar a medição. Cada amostra válida atualiza o velocímetro com velocidade realmente recebida do M-Lab; nenhum valor é simulado. A descoberta tem limite HTTP de 10 s, cada tentativa de conexão tem limite de 4 s, download e upload têm limites de 20/15 s e a tarefa tem limite global de 95 s. O worker converte panic em erro retornado ao comando. A interface aplica ainda um watchdog de 100 s, inclusive ao registro do listener IPC, remove inscrições e ignora eventos/respostas atrasados. Há uma etapa separada de conexão antes do download. A seleção tenta até três servidores e repete IPv4 quando o primeiro endereço DNS não funciona.

## Métricas

- Download: contadores AppInfo do cliente NDT7 em bytes e microssegundos.
- Upload: TCPInfo.BytesReceived/ElapsedTime retornados pelo M-Lab; fallback a contadores locais se ausentes.
- Ping: mediana de amostras TCPInfo.RTT do M-Lab, convertidas de microssegundos a milissegundos.
- Jitter: média das diferenças absolutas entre RTTs consecutivos (TCP, não jitter WebRTC).
- IP público: `ConnectionInfo.Client` retornado pelo M-Lab. Não substitua por endereço LAN. Pode estar indisponível.
- Qualidade e data: calculadas/exibidas localmente após conclusão.

NDT7 pode transferir **centenas de MB ou mais** em redes rápidas; não há limite garantido de 29 MB. Nenhuma medição automática. Tocar em **Medir agora** inicia o teste, após aviso claro de publicação do IP, horário e resultados pelo M-Lab, sem checkbox adicional.

## Privacidade

O M-Lab publica os dados de medição, incluindo IP e horário: https://www.measurementlab.net/privacy/ . O AURORA armazena SOMENTE as últimas cinco linhas com download, upload e ping no dispositivo. Não persistir IP, jitter, hora, cidade nem consentimento. Não criar servidores customizados nem adicionar outras fontes para velocidade.

## Testes

Unitários Rust com amostras NDT7, cálculo calibrado do velocímetro, aviso de privacidade sem checkbox e colunas históricas. Um teste vivo opt-in em GitHub Actions valida download/upload e latência real do M-Lab; não simular valores quando endpoints estiverem indisponíveis.

**Não modificar os mecanismos de atualização Android validados na 0.0.25/0.0.26**: FileProvider exclusivo, APK, SHA-256, assinatura, URI e testes instrumentados.


## Causa do travamento no Android

`ndt7-client 0.3.0` usa `reqwest 0.13` na descoberta implícita. Esse cliente usa `rustls-platform-verifier`, cujo caminho Android exige inicialização de JVM/Context e componentes Kotlin próprios. Essa integração não existe no LIVES. Uma falha nativa nesse caminho podia encerrar o worker sem responder ao Promise do Tauri; timeout assíncrono não captura panic.

A correção mantém verificação de certificados e hostname, M-Lab como provedor e NDT7 sobre WSS. Não muda o atualizador, sua assinatura nem suas permissões. O teste Android compila o mesmo motor Rust e reproduz o cliente antigo, exigindo a mensagem `Expect rustls-platform-verifier to be initialized`, depois exige descoberta HTTPS válida pelo motor corrigido.

Referências primárias: [reqwest 0.13 — configuração TLS](https://docs.rs/reqwest/0.13.5/src/reqwest/async_impl/client.rs.html), [inicialização Android do verificador](https://docs.rs/rustls-platform-verifier/latest/src/rustls_platform_verifier/android.rs.html).

O workflow de rede testa o motor de produção sem GTK/Tauri, faz uma medição real completa em runner Linux e executa a regressão TLS em emulador Android 15. Os testes normais do aplicativo continuam verificando IPC/UI, recuperação de timeout, protocolo P2P e compilação dos APKs. Resultados numéricos nunca são inventados; falta de capacidade ou bloqueio de rede retorna erro e libera nova tentativa.
