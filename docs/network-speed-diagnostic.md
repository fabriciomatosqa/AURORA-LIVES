# AURORA LIVES — Teste de conexão M-Lab NDT7 (v0.0.28)

## Provedor único

Somente **Measurement Lab (M-Lab)** via cliente Rust NDT7 0.3.0 com WebSockets seguros. A descoberta automática usa `https://locate.measurementlab.net/v2/nearest/ndt/ndt7` e retorna URLs de servidor e token transitório. Não existe servidor HTTP personalizável, Cloudflare para velocidade nem serviço IPify. Não desabilitar TLS.

## Métricas

- Download: contadores AppInfo do cliente NDT7 em bytes e microssegundos.
- Upload: TCPInfo.BytesReceived/ElapsedTime retornados pelo M-Lab; fallback a contadores locais se ausentes.
- Ping: mediana de amostras TCPInfo.RTT do M-Lab, convertidas de microssegundos a milissegundos.
- Jitter: média das diferenças absolutas entre RTTs consecutivos (TCP, não jitter WebRTC).
- IP público: `ConnectionInfo.Client` retornado pelo M-Lab. Não substitua por endereço LAN. Pode estar indisponível.
- Qualidade e data: calculadas/exibidas localmente após conclusão.

NDT7 pode transferir **centenas de MB ou mais** em redes rápidas; não há limite garantido de 29 MB. Nenhuma medição automática: checkbox de autorização para cada teste, desmarcado ao iniciar.

## Privacidade

O M-Lab publica os dados de medição, incluindo IP e horário: https://www.measurementlab.net/privacy/ . O AURORA armazena SOMENTE as últimas cinco linhas com download, upload e ping no dispositivo. Não persistir IP, jitter, hora, cidade nem consentimento. Não criar servidores customizados nem adicionar outras fontes para velocidade.

## Testes

Unitários Rust com amostras NDT7, UI com confirmação de consentimento e colunas históricas. Um teste vivo opt-in em GitHub Actions valida download/upload e latência real do M-Lab; não simular valores quando endpoints estiverem indisponíveis.

**Não modificar os mecanismos de atualização Android validados na 0.0.25/0.0.26**: FileProvider exclusivo, APK, SHA-256, assinatura, URI e testes instrumentados.
