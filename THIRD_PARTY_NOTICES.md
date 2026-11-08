# Převzaté součásti

Licence MIT v kořeni se vztahuje na vlastní práci tohoto projektu. Existující licence a oznámení převzatých součástí zůstávají zachované.

| Součást | Původ | Licence / oznámení |
| --- | --- | --- |
| Vendorizovaný Sites Vite plugin | `@openai/sites-vite-plugin` 0.2.0, OpenAI | MIT, [scripts/vite/sites-vite-plugin.LICENSE](scripts/vite/sites-vite-plugin.LICENSE) |
| Zachovaná komponenta tlačítka shadcn | shadcn | MIT, [vendor/shadcn-tailwind-4.13.0.LICENSE.md](vendor/shadcn-tailwind-4.13.0.LICENSE.md) |
| LiveKit klient | `livekit-client` 2.23.0 | Apache-2.0; soubor `LICENSE` v distribuovaném npm balíčku. |
| LiveKit server SDK | `livekit-server-sdk` 2.19.2 | Apache-2.0; soubor `LICENSE` v distribuovaném npm balíčku. |
| Volitelný LiveKit server | `livekit/livekit-server:v1.13.11` | Apache-2.0; samostatná služba a její distribuovaná oznámení. |
| `components/ui/button.tsx` pro konektorový panel | shadcn a Radix UI | Zachovat oznámení shadcn uvedené výše a licence příslušných závislostí. Ostatní nepoužívané UI šablony byly odstraněné. |

Aplikace vychází z vývojové šablony Vinext/Sites. Zůstaly v ní pomocné skripty pro lokální prostředí a původní hosting; projekt neobsahuje identifikátor soukromého nasazení ani přístupové údaje.

Verze závislostí jsou uzamčené v `package-lock.json`. Licence balíčků jsou v jejich distribuovaných souborech a metadatech; tento seznam nenahrazuje jejich vlastní podmínky. Při distribuci sestavení je nutné zachovat příslušná oznámení.

Herní příručky a ilustrace ALTAR se s aplikací nedistribuují. Odkaz na zdroj pravidlového mechanismu v README není licencí k obsahu těchto příruček.
