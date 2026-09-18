![Banner image](https://user-images.githubusercontent.com/10284570/173569848-c624317f-42b1-45a6-ab09-f0ea3c247648.png)

# n8n-nodes-starter

This starter repository helps you build custom integrations for [n8n](https://n8n.io). It includes example nodes, credentials, the node linter, and all the tooling you need to get started.

## Quick Start

> [!TIP]
> **New to building n8n nodes?** The fastest way to get started is with `npm create @n8n/node`. This command scaffolds a complete node package for you using the [@n8n/node-cli](https://www.npmjs.com/package/@n8n/node-cli).

**To create a new node package from scratch:**

```bash
npm create @n8n/node
```

**Already using this starter? Start developing with:**

```bash
npm run dev
```

This starts n8n with your nodes loaded and hot reload enabled.

## What's Included

This starter repository includes two example nodes to learn from:

- **[Example Node](nodes/Example/)** - A simple starter node that shows the basic structure with a custom `execute` method
- **[GitHub Issues Node](nodes/GithubIssues/)** - A complete, production-ready example built using the **declarative style**:
  - **Low-code approach** - Define operations declaratively without writing request logic
  - Multiple resources (Issues, Comments)
  - Multiple operations (Get, Get All, Create)
  - Two authentication methods (OAuth2 and Personal Access Token)
  - List search functionality for dynamic dropdowns
  - Proper error handling and typing
  - Ideal for HTTP API-based integrations

> [!TIP]
> The declarative/low-code style (used in GitHub Issues) is the recommended approach for building nodes that interact with HTTP APIs. It significantly reduces boilerplate code and handles requests automatically.

Browse these examples to understand both approaches, then modify them or create your own.

## Finding Inspiration

Looking for more examples? Check out these resources:

- **[npm Community Nodes](https://www.npmjs.com/search?q=keywords:n8n-community-node-package)** - Browse thousands of community-built nodes on npm using the `n8n-community-node-package` tag
- **[n8n Built-in Nodes](https://github.com/n8n-io/n8n/tree/master/packages/nodes-base/nodes)** - Study the source code of n8n's official nodes for production-ready patterns and best practices
- **[n8n Credentials](https://github.com/n8n-io/n8n/tree/master/packages/nodes-base/credentials)** - See how authentication is implemented for various services

These are excellent resources to understand how to structure your nodes, handle different API patterns, and implement advanced features.

## Prerequisites

Before you begin, install the following on your development machine:

### Required

- **[Node.js](https://nodejs.org/)** (v22 or higher) and npm
  - Linux/Mac/WSL: Install via [nvm](https://github.com/nvm-sh/nvm)
  - Windows: Follow [Microsoft's NodeJS guide](https://learn.microsoft.com/en-us/windows/dev-environment/javascript/nodejs-on-windows)
- **[git](https://git-scm.com/downloads)**

### Recommended

- Follow n8n's [development environment setup guide](https://docs.n8n.io/integrations/creating-nodes/build/node-development-environment/)

> [!NOTE]
> The `@n8n/node-cli` is included as a dev dependency and will be installed automatically when you run `npm install`. The CLI includes n8n for local development, so you don't need to install n8n globally.

## Getting Started with this Starter

Follow these steps to create your own n8n community node package:

### 1. Create Your Repository

[Generate a new repository](https://github.com/n8n-io/n8n-nodes-starter/generate) from this template, then clone it:

```bash
git clone https://github.com/<your-organization>/<your-repo-name>.git
cd <your-repo-name>
```

### 2. Install Dependencies

```bash
npm install
```

This installs all required dependencies including the `@n8n/node-cli`.

### 3. Explore the Examples

Browse the example nodes in [nodes/](nodes/) and [credentials/](credentials/) to understand the structure:

- Start with [nodes/Example/](nodes/Example/) for a basic node
- Study [nodes/GithubIssues/](nodes/GithubIssues/) for a real-world implementation

### 4. Build Your Node

Edit the example nodes to fit your use case, or create new node files by copying the structure from [nodes/Example/](nodes/Example/).

> [!TIP]
> If you want to scaffold a completely new node package, use `npm create @n8n/node` to start fresh with the CLI's interactive generator.

### 5. Configure Your Package

Update `package.json` with your details:

- `name` - Your package name (must start with `n8n-nodes-`)
- `author` - Your name and email
- `repository` - Your repository URL
- `description` - What your node does

Make sure your node is registered in the `n8n.nodes` array.

### 6. Develop and Test Locally

Este proyecto usa **pnpm** y n8n instalado globalmente con pnpm, en lugar de
dejar que el CLI reinstale n8n con `npx` en cada arranque.

Preparacion (una sola vez):

```bash
pnpm install
pnpm setup:n8n
```

`pnpm setup:n8n` instala n8n globalmente con pnpm y le deja listo el binario
nativo de `sqlite3`. Ese segundo paso hace falta porque pnpm no ejecuta los
scripts de build de las dependencias, y sin el binario n8n muere al arrancar con
`SQLite package has not been found installed`. El script baja el prebuild NAPI,
que no necesita compilador.

Luego, en **dos terminales**:

```bash
pnpm dev       # compila el nodo en watch y lo enlaza al user folder de n8n
pnpm dev:n8n   # levanta n8n en http://localhost:5678
```

- `pnpm dev` corre `n8n-node dev --external-n8n`: compila a `dist/` en watch.
- `pnpm dev:n8n` enlaza `dist/` dentro de `~/.n8n-node-cli/.n8n/custom/node_modules`
  y arranca n8n con `N8N_DEV_RELOAD=true` para que recargue tras cada build.

> [!IMPORTANT]
> El enlace apunta a `dist/`, no a la raiz del proyecto, porque las rutas de
> `n8n.nodes` en `package.json` van sin el prefijo `dist/` (asi las necesita
> `pnpm deploy`, que copia el contenido de `dist/` al servidor). El symlink que
> crea el CLI por su cuenta apunta a la raiz y n8n no encuentra los `.js`.

> [!NOTE]
> n8n 2.x requiere **Node >= 24**. El `engines.runtime` de `package.json` hace
> que pnpm descargue y use Node 24 solo para este proyecto, sin tocar el Node
> del sistema.

Si prefieres el modo original (n8n embebido, lo instala con `npx` y tarda
varios minutos cada arranque):

```bash
pnpm dev:bundled
```

You can now test your node in n8n workflows!

> [!NOTE]
> Learn more about CLI commands in the [@n8n/node-cli documentation](https://www.npmjs.com/package/@n8n/node-cli).

#### Velver Process Form y Velver Process Form Trigger (`<vc-process>` / `<vc-form>`)

Los dos nodos sirven una página con el formulario por etapas del front de
proyecto_x y entregan el registro capturado como item (los archivos llegan como
binarios). Cambia cuándo corre el workflow, igual que *Form Trigger* y *Form* en
n8n:

| Nodo | URL | Qué hace el envío |
|---|---|---|
| **Velver Process Form Trigger** | fija: `/form/<ruta>` (prueba: `/form-test/<ruta>`) | **inicia** una ejecución nueva |
| **Velver Process Form** | un link por ejecución: `$execution.resumeFormUrl` (`/form-waiting/<id>`) | **reanuda** la ejecución que esperaba |

Usa el trigger cuando el formulario es la entrada del proceso. Usa el nodo de
link cuando el formulario va a mitad del flujo: precargar datos de nodos
anteriores (`Datos Iniciales` admite expresiones sobre el item) o pedir una
captura/aprobación y seguir.

En modo prueba, el editor de n8n abre solo el formulario del nodo de link, pero
no el del trigger (esa apertura automática está fija para el Form Trigger nativo):
pulsa *Execute step* y abre la *Test URL* que muestra el nodo.

El código de los componentes **no se copia**: `proyecto_x/front` sigue siendo la
fuente de verdad y aquí solo vive una foto compilada en
`nodes/VelverProcessForm/assets/vcProcess.bundle.json`. Para actualizarla después
de cambiar `vc-process` o `vc-form`:

```bash
pnpm build:vc-process                          # usa D:/proyecto_x/front
VC_FRONT_DIR=/ruta/al/front pnpm build:vc-process
VC_BUNDLE_REPORT=1 pnpm build:vc-process       # además imprime el peso por paquete
```

**Configuración: un solo estado.** La interfaz del nodo tiene la misma forma que
vc-process: *Etapas* (título y descripción) → *Secciones* (subtítulo) → *Campos*.
Cada campo lleva etiqueta, tipo, obligatorio, **deshabilitado**, **oculto**
(`hideInForm`), **valor por defecto** (admite expresiones; se convierte al tipo
del campo), opciones y «Más opciones».

*JSON avanzado* es opcional y **complementa** la interfaz en vez de reemplazarla:
*Campos (JSON)* mezcla propiedades por clave (`{"curp": {"pattern": "…"}}`) o
acepta un `FieldConfig[]`; *Proceso (JSON)* se mezcla sobre el proceso
(`presets`, `title`; `stages` reemplaza las etapas); *Datos iniciales (JSON)* se
suma a los valores por defecto. Con *Etapas* vacías, el JSON avanzado define el
formulario completo. No hay selector de modo a propósito: el editor de n8n
descarta los parámetros que quedan ocultos, y cambiar de modo borraba lo
capturado. La transformación a `ProcessConfig`/`FieldConfig[]` ocurre en cada
ejecución; para ver el resultado, abre la URL de **prueba** con `?json` (en
producción no existe).

**Campos alternos (misma clave).** Varios campos pueden compartir la clave si
**todos** tienen *Mostrar Si*, para que aplique uno a la vez (p. ej. un `user_id`
de texto con `modo = "A"` y otro de lista con `modo = "B"`). Como vc-form guarda
visibilidad, errores y opciones por clave, cada variante lleva una clave interna
(`user_id__alt2`); al enviar, la página evalúa los `show_if` y manda una sola
`user_id` con el valor del campo visible (el servidor hace lo mismo como
respaldo). Un pre-relleno con esa clave llena todas las variantes. Las
expresiones de OTROS campos que lean esa clave ven la primera variante, y los
campos alternos no se imponen como deshabilitados u ocultos.

Lo que la persona no puede editar queda impuesto por el servidor: campos
deshabilitados u ocultos conservan su valor (por defecto o pre-rellenado) aunque
la página mande otro, salvo los calculados; los `presets` siempre mandan. Un
campo oculto nunca es obligatorio.

**Sobre cifrado.** Como en proyecto_x, nada del formulario viaja legible: el
HTML solo trae el bundle; la página pide el challenge (POST a la misma URL con
`x-vc-challenge`), recibe la configuración sellada con el sobre v2 y envía el
registro sellado (`{content: "v2.<win>.<blob>"}` + cabeceras rotadas). Un POST
sin sobre válido recibe `400 solicitud no válida` + `x-vc-env: renew`. El núcleo
está portado de `back/src/security/envelopeV2.js` y la página usa el
`EnvelopeAgent` original del front; si cambia la derivación allá, hay que
cambiar `utils/envelope.ts` y reconstruir el bundle. El secreto se genera por
proceso de n8n: tras un reinicio, las páginas abiertas renuevan el challenge
solas.

No dependen del backend de proyecto_x: etapas, secciones, validación de
requeridos y formatos, `show_if` / `enabled_if` / `calculation` (JSONata),
opciones estáticas y `presets` (el nodo los vuelve a sellar al recibir el envío).
Sí dependen de él, y por eso **no** funcionan aquí: combos con opciones de una
tabla (`query`/`search`), secciones de partidas (`childTable`), documentos Word,
importar Excel y el visor del SAT.

**Teléfono.** `<vc-tel>` pide la tabla global `paises` al backend; el build lo
cambia por `scripts/stubs/vc-tel-countries.ts`, que trae solo ISO-2 + lada
empaquetados desde `back/src/data/global/rows/paises.json` (~1.2 KB), toma los
nombres de `Intl.DisplayNames` y deja las banderas a flagcdn (sin emojis).

**Al enviar.** *Mostrar mensaje de término* (por defecto) confirma de inmediato
y el workflow sigue por su cuenta. *Esperar al workflow (Markdown)* deja la
página esperando —con el *Mensaje mientras procesa*— y pinta como markdown el
*Campo del resultado* (`markdown` por defecto) del item que devuelva el último
nodo; si ese campo viene vacío, muestra el mensaje de término. En ese modo el
webhook contesta en `lastNode`, así que la respuesta la arma n8n y viaja en
claro (el envío sí va sellado), y si el workflow falla la página lo dice.

**Texto informativo (Markdown).** El tipo *Texto Informativo (Markdown)* despliega
su *Contenido* con formato (encabezados, listas, tablas, negritas, ligas) usando
`<vc-markdown>` de Seemly, que pinta con el markdown compartido de la casa
(`base/markdown/`: plantillas de Lit, sin `unsafeHTML`; un `<script>` se imprime
como texto). No es un input: ocupa el renglón completo, no captura dato y su clave
nunca viaja en el envío. El contenido admite expresiones de n8n.

**Opciones de listas.** En campos de lista desplegable, lista con búsqueda y
radio, *Opciones como* elige entre capturarlas una por una (*Lista*) o en *JSON*:
arreglo de `{label, value}`, arreglo de textos (`["Norte", "Sur"]`) u objeto
`{valor: texto}`. El JSON admite expresiones, así que un catálogo que trae un nodo
anterior se usa directo.

**Pre-relleno cifrado.** Con «Permitir pre-relleno cifrado» en el trigger, el
formulario acepta `?p=<token>` para abrir con algunos campos llenos. El token lo
genera el nodo **Velver Form Prefill** (URL del formulario + pares clave/valor
con expresiones + vencimiento opcional); ambos usan la misma credencial *Velver
Form Prefill API*. Es AES-256-GCM: no se puede leer ni alterar sin el secreto,
solo el servidor lo abre y los valores llegan a la página dentro de la
configuración sellada. Se convierten al tipo del campo, las claves que no son
campos se ignoran y en un campo deshabilitado el valor queda impuesto (sirve
para fijar datos por enlace, como el id de un cliente). Un token alterado, de
otra credencial o vencido muestra un aviso en lugar del formulario.

**Columnas.** El parámetro *Columnas* (1, 2 o 3; 2 por defecto) aplica a todas
las secciones: vc-process pasa el mismo número a cada una. En pantallas angostas
los campos siempre se apilan. Cada campo puede ocupar más espacio con *Más
opciones → Ancho* (`span: 2 | "full"` en modo JSON): 2 columnas desde 640px o
el renglón completo. `vc-form` no trae esa opción, así que el build la agrega con
un parche local (`fieldSpan` en `scripts/build-vc-process.mjs`), sin tocar
proyecto_x; si el código de `vc-form` cambia y el parche ya no calza, el build
falla con un mensaje en vez de perder la opción.

Con el nodo de link, en producción envía `$execution.resumeFormUrl` a quien
capturará desde un nodo anterior (por ejemplo, un *Respond to Webhook* o un
mensaje de Telegram). En los dos nodos, el POST que aparece en los webhooks es el
envío que hace la propia página; no hay que llamarlo a mano. En la carpeta
`custom` los tipos son `CUSTOM.velverProcessFormTrigger` y
`CUSTOM.velverProcessForm`.

### 7. Lint Your Code

Check for errors:

```bash
npm run lint
```

Auto-fix issues when possible:

```bash
npm run lint:fix
```

### 8. Build for Production

When ready to publish:

```bash
npm run build
```

This compiles your TypeScript code to the `dist/` folder.

### 9. Prepare for Publishing

Before publishing:

1. **Update documentation**: Replace this README with your node's documentation. Use [README_TEMPLATE.md](README_TEMPLATE.md) as a starting point.
2. **Update the LICENSE**: Add your details to the [LICENSE](LICENSE.md) file.
3. **Test thoroughly**: Ensure your node works in different scenarios.

### 10. Publish to npm

Publish your package to make it available to the n8n community:

```bash
npm publish
```

Learn more about [publishing to npm](https://docs.npmjs.com/packages-and-modules/contributing-packages-to-the-registry).

### 11. Submit for Verification (Optional)

Get your node verified for n8n Cloud:

1. Ensure your node meets the [requirements](https://docs.n8n.io/integrations/creating-nodes/deploy/submit-community-nodes/):
   - Uses MIT license ✅ (included in this starter)
   - No external package dependencies
   - Follows n8n's design guidelines
   - Passes quality and security review

2. Submit through the [n8n Creator Portal](https://creators.n8n.io/nodes)

**Benefits of verification:**

- Available directly in n8n Cloud
- Discoverable in the n8n nodes panel
- Verified badge for quality assurance
- Increased visibility in the n8n community

## Available Scripts

This starter includes several npm scripts to streamline development:

| Script                | Description                                                      |
| --------------------- | ---------------------------------------------------------------- |
| `npm run dev`         | Start n8n with your node and watch for changes (runs `n8n-node dev`) |
| `npm run build`       | Compile TypeScript to JavaScript for production (runs `n8n-node build`) |
| `npm run build:watch` | Build in watch mode (auto-rebuild on changes)                    |
| `npm run lint`        | Check your code for errors and style issues (runs `n8n-node lint`) |
| `npm run lint:fix`    | Automatically fix linting issues when possible (runs `n8n-node lint --fix`) |
| `npm run release`     | Create a new release (runs `n8n-node release`)                   |

> [!TIP]
> These scripts use the [@n8n/node-cli](https://www.npmjs.com/package/@n8n/node-cli) under the hood. You can also run CLI commands directly, e.g., `npx n8n-node dev`.

## Troubleshooting

### My node doesn't appear in n8n

1. Make sure you ran `npm install` to install dependencies
2. Check that your node is listed in `package.json` under `n8n.nodes`
3. Restart the dev server with `npm run dev`
4. Check the console for any error messages

### Linting errors

Run `npm run lint:fix` to automatically fix most common issues. For remaining errors, check the [n8n node development guidelines](https://docs.n8n.io/integrations/creating-nodes/).

### TypeScript errors

Make sure you're using Node.js v22 or higher and have run `npm install` to get all type definitions.

## Resources

- **[n8n Node Documentation](https://docs.n8n.io/integrations/creating-nodes/)** - Complete guide to building nodes
- **[n8n Community Forum](https://community.n8n.io/)** - Get help and share your nodes
- **[@n8n/node-cli Documentation](https://www.npmjs.com/package/@n8n/node-cli)** - CLI tool reference
- **[n8n Creator Portal](https://creators.n8n.io/nodes)** - Submit your node for verification
- **[Submit Community Nodes Guide](https://docs.n8n.io/integrations/creating-nodes/deploy/submit-community-nodes/)** - Verification requirements and process

## Contributing

Have suggestions for improving this starter? [Open an issue](https://github.com/n8n-io/n8n-nodes-starter/issues) or submit a pull request!

## License

[MIT](https://github.com/n8n-io/n8n-nodes-starter/blob/master/LICENSE.md)
