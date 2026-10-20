# Better xCloud para TizenBrew (Samsung Tizen)

Módulo TizenBrew que abre o Xbox Cloud Gaming (`xbox.com/pt-BR/play`) com o
[Better xCloud](https://github.com/redphx/better-xcloud) 6.7.12 do redphx, com o
co-op local (vários controles) ligado por padrão.

## Arquivos

- `better-xcloud.user.js`: release oficial v6.7.12, sem alterações
  (sha256 bb78931b4ec94d68cb18da97fa4ae1f88e6b3103bc159905931b2238a51b517e).
- `bx-wrapper.js`: o mesmo script dentro de um invólucro que (1) só roda em www.xbox.com,
  (2) espera o `<html>` existir (o Better xCloud quebra se rodar antes), (3) evita carga dupla e
  (4) liga `localCoOp.enabled` se ainda não houver preferência.
- `service.js`: serviço do módulo (roda no TizenBrew, na TV). Conecta ao DevTools local da página e
  registra o `bx-wrapper.js` com `Page.addScriptToEvaluateOnNewDocument`, para ele rodar **antes**
  do carregador de scripts do Xbox, condição para os patches (incluindo o de co-op) pegarem. Se a
  página abriu antes do registro, recarrega uma vez. Também retoma páginas pausadas pelo depurador
  (o login da Microsoft trava sem isso) e reconecta quando a página troca de processo.

Motivo: no TizenBrew 2.0.5, `evaluateScriptOnDocumentStart` não abre o site, e a injeção normal
chega tarde quando os scripts do Xbox já estão em cache.

Instalação: TizenBrew → Module Manager → Add GitHub Module → `marcusvitalesilva-dot/tizenbrew-better-xcloud@<commit>` (fixar o commit evita o cache do jsDelivr).

Licença do Better xCloud: MIT (ver `LICENSE-better-xcloud`). Sem afiliação com Microsoft/Xbox.
