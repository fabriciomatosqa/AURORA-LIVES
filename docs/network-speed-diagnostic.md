# AURORA LIVES — Medidor de rede manual

Comando Tauri nativo Rust `measure_connection`, independente do atualizador Android. Medições reais sobre HTTPS até `https://speed.cloudflare.com/__down` e `/__up`: 2 + 18 MB download, 1 + 8 MB upload. Limites: conexão 8 s e requisição 25 s. HTTP ping: mediana de 6 chamadas de zero bytes, jitter como média da diferença consecutiva absoluta. **Não** representa ping ICMP nem qualidade específica do WebRTC e não mede perda de pacotes.

IP externo observado por `https://speed.cloudflare.com/meta`, validado como endereço público; se não puder ser consultado, mostrar Indisponível. Nunca substituir pelo IP LAN. O serviço externo recebe as requisições de teste, não os resultados salvos no AURORA.

O frontend só invoca o comando após consentimento ao clicar Medir agora; não há consultas automáticas. Histórico local limitado a 5 registros com somente `downloadMbps`, `uploadMbps`, `pingMs`. Não armazenar horário, IP nem jitter no histórico. A classificação Excelente/Boa/Regular/Ruim é orientativa.

**Não modificar** o fluxo comprovado de atualização Android v0.0.25/26: `ApkFileProvider`, `ApkUpdateInstaller`, validação SHA-256/URI, assinatura e workflows de instrumentação.
