# Better xCloud para TizenBrew (Samsung Tizen)

Módulo TizenBrew que abre o Xbox Cloud Gaming (`xbox.com/pt-BR/play`) com o
[Better xCloud](https://github.com/redphx/better-xcloud) 6.7.12 do redphx injetado,
para usar recursos como o co-op local (vários controles).

- `better-xcloud.user.js` é o arquivo oficial da release v6.7.12, sem alterações
  (sha256 no fim deste arquivo).
- Diferença para o módulo `redphx/bx`: não usa `evaluateScriptOnDocumentStart`,
  caminho que no TizenBrew 2.0.5 não chega a abrir o site.

Instalação: TizenBrew → Module Manager → Add GitHub Module → `marcusvitalesilva-dot/tizenbrew-better-xcloud`.

Licença do Better xCloud: MIT (ver `LICENSE-better-xcloud`). Projeto sem afiliação com Microsoft/Xbox.

sha256 better-xcloud.user.js: bb78931b4ec94d68cb18da97fa4ae1f88e6b3103bc159905931b2238a51b517e
