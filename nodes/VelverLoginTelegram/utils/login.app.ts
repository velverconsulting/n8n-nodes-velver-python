const defaultLogo =
	'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iOTg0IiBoZWlnaHQ9IjEwMDkiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyIgeG1sbnM6eGxpbms9Imh0dHA6Ly93d3cudzMub3JnLzE5OTkveGxpbmsiIHhtbDpzcGFjZT0icHJlc2VydmUiIG92ZXJmbG93PSJoaWRkZW4iPjxnIHRyYW5zZm9ybT0idHJhbnNsYXRlKC0yNTEzIC0zNTUpIj48cGF0aCBkPSJNMjk5NC43MiAxMDQyLjQ3QzI5MzUuMDMgMTA0Mi40NyAyODc4LjgyIDEwMTMuMjQgMjg0NC4zNyA5NjQuMzM0TDI4MTkuOTkgOTI5LjcxNSAyNTUzLjgxIDkyOS43MTVDMjUzMS4yOSA5MjkuNzE1IDI1MTMgOTQ3Ljk1MiAyNTEzIDk3MC40ODEgMjUxMyA5OTIuOTc3IDI1MzEuMjYgMTAxMS4yNSAyNTUzLjgxIDEwMTEuMjVMMjc3Ny42MyAxMDExLjI1QzI4MjcuMzUgMTA4MS44NiAyOTA4LjUyIDExMjQgMjk5NC43MiAxMTI0IDMxNDEuMDEgMTEyNCAzMjYwIDEwMDUuMSAzMjYwIDg1OSAzMjYwIDcxMi44NjUgMzE0MC45NyA1OTQgMjk5NC43MiA1OTQgMjkzMi40NSA1OTQgMjg3Mi45IDYxNi4wODMgMjgyNS44NyA2NTQuODU4IDI4NDMuNTQgNjc4LjQ1MyAyODU0LjYxIDcwNy4xNjQgMjg1Ni40MyA3MzguNDE3IDI4OTEuMTYgNjk4Ljc1IDI5NDEuNTMgNjc1LjQ5OSAyOTk0LjcyIDY3NS40OTkgMzA5NiA2NzUuNDk5IDMxNzguNDEgNzU3LjgyMiAzMTc4LjQxIDg1OSAzMTc4LjQxIDk2MC4xNzggMzA5NiAxMDQyLjQ3IDI5OTQuNzIgMTA0Mi40N1oiIGZpbGw9IiM5RDlEOUQiIGZpbGwtcnVsZT0iZXZlbm9kZCIvPjxwYXRoIGQ9Ik0yNzY5LjA2IDYwNy45OThDMjgzMy4wOCA1NTEuMTE1IDI5MTguNzYgNTE4LjEyIDMwMTIuMTEgNTIzLjQ4MiAzMTc5LjIxIDUzMy4xMDYgMzMxNS41MyA2NjYuODM5IDMzMjguMDUgODMzLjY3MSAzMzQyLjg2IDEwMzAuODkgMzE4Ni41MyAxMTk2LjE0IDI5OTIuMyAxMTk2LjE0IDI4NzguNSAxMTk2LjE0IDI3NzcuNzYgMTEzOS4zNiAyNzE2LjggMTA1Mi42OEwyNjEzLjUxIDEwNTIuNjhDMjYyOC41NyAxMDc0LjM2IDI2MzEuMzYgMTEwNC4zMyAyNjE0LjkyIDExMjkuNzdMMjU4OSAxMTY5Ljk1QzI2MDkuMDUgMTE5Ni4wNyAyNjMxLjQzIDEyMjAuMDIgMjY1NS45MSAxMjQxLjU3TDI2OTcuODUgMTIxOC4yN0MyNzQ1LjM0IDExOTEuODggMjgwMy4zNCAxMjI3LjkzIDI4MDAuNjYgMTI4Mi4yTDI3OTguMzIgMTMyOS45QzI4MTMuMzggMTMzNi4wOSAyODI4LjgyIDEzNDEuNTkgMjg0NC42IDEzNDYuMzcgMjg2MC4zOCAxMzUxLjE1IDI4NzYuMjYgMTM1NS4xMyAyODkyLjIyIDEzNTguMzZMMjkxNi43NyAxMzE3LjM5QzI5NDQuNjggMTI3MC44MiAzMDEyLjk3IDEyNzMuMDYgMzAzNy43NiAxMzIxLjM1TDMwNTkuNjYgMTM2NEMzMDkxLjk4IDEzNTkuNjcgMzEyMy45MiAxMzUyLjIxIDMxNTUuMSAxMzQxLjU5TDMxNTUuODkgMTI5My43OEMzMTU2Ljc5IDEyMzkuNDggMzIxNy4wMyAxMjA3LjMxIDMyNjIuNjkgMTIzNi43M0wzMzAyLjg4IDEyNjIuNjRDMzMyOS4wMSAxMjQyLjYxIDMzNTIuOTcgMTIyMC4yMyAzMzc0LjUzIDExOTUuNzZMMzM1MS4yMiAxMTUzLjgzQzMzMjQuODEgMTEwNi4zNiAzMzYwLjg4IDEwNDguMzggMzQxNS4xNyAxMDUxLjA2TDM0NjIuODkgMTA1My40QzM0NjkuMDggMTAzOC4zNCAzNDc0LjU4IDEwMjIuOTEgMzQ3OS4zNiAxMDA3LjE0IDM0ODQuMTQgOTkxLjM2MSAzNDg4LjEzIDk3NS40ODIgMzQ5MS4zNiA5NTkuNTM0TDM0NTAuMzggOTM0Ljk5NEMzNDAzLjc5IDkwNy4wODUgMzQwNi4wMiA4MzguODI2IDM0NTQuMzMgODE0LjA0NkwzNDk3IDc5Mi4xNTJDMzQ5Mi42NyA3NTkuODQ0IDM0ODUuMjEgNzI3LjkxNSAzNDc0LjU4IDY5Ni43NDFMMzQyNi43NiA2OTUuOTg1QzMzNzIuNDMgNjk1LjA5MSAzMzQwLjI1IDYzNC44NzUgMzM2OS42OCA1ODkuMjMyTDMzOTUuNjEgNTQ5LjA1M0MzMzc1LjU2IDUyMi45MzIgMzM1My4xOCA0OTguOTc2IDMzMjguNyA0NzcuNDI2TDMyODYuNzUgNTAwLjcyOUMzMjM5LjI3IDUyNy4xMjUgMzE4MS4yNyA0OTEuMDcxIDMxODMuOTUgNDM2LjgwMUwzMTg2LjI5IDM4OS4wOTVDMzE3MS4yMyAzODIuOTA5IDMxNTUuNzkgMzc3LjQwOSAzMTQwLjAxIDM3Mi42MzIgMzEyNC4yMyAzNjcuODU0IDMxMDguMzQgMzYzLjg2OCAzMDkyLjM5IDM2MC42MzdMMzA2Ny44NCA0MDEuNjA2QzMwMzkuOTIgNDQ4LjIxMiAyOTcxLjY0IDQ0NS45NDMgMjk0Ni44NSAzOTcuNjUzTDI5MjQuOTUgMzU1QzI4OTIuNjMgMzU5LjMzMSAyODYwLjY5IDM2Ni43ODkgMjgyOS41IDM3Ny40MDlMMjgyOC43MSA0MjUuMjE4QzI4MjcuODIgNDc5LjUyMyAyNzY3LjU4IDUxMS42OTMgMjcyMS45MiA0ODIuMjcyTDI2ODEuNzMgNDU2LjM1N0MyNjU1LjYgNDc2LjM5NSAyNjMxLjYzIDQ5OC43NyAyNjEwLjA4IDUyMy4yNDFMMjYzMy4zOSA1NjUuMTczQzI2NDAuNjEgNTc4LjE2NCAyNjQzLjA4IDU5MS45MTIgMjY0MS44NSA2MDUuMDA4IDI2NjAuNDUgNTk3LjEwMiAyNjgwLjg3IDU5Mi43MzcgMjcwMi4zMiA1OTIuNzM3IDI3MjYuMjUgNTkyLjcwMyAyNzQ4LjgxIDU5OC4zMDUgMjc2OS4wNiA2MDcuOTk4WiIgZmlsbC1ydWxlPSJldmVub2RkIi8+PHBhdGggZD0iTTI4MTMgNzQ3LjVDMjgxMyA4MDguNTI4IDI3NjMuMyA4NTggMjcwMiA4NTggMjY0MC43IDg1OCAyNTkxIDgwOC41MjggMjU5MSA3NDcuNSAyNTkxIDY4Ni40NzIgMjY0MC43IDYzNyAyNzAyIDYzNyAyNzYzLjMgNjM3IDI4MTMgNjg2LjQ3MiAyODEzIDc0Ny41WiIgZmlsbD0iIzU3NTc1NiIgZmlsbC1ydWxlPSJldmVub2RkIi8+PC9nPjwvc3ZnPg==';

export function renderApp(
	webhook: string,
	language: string,
	name: string,
	logo: string = defaultLogo,
): string {
	return `
    <!DOCTYPE html>
    <html lang="${language}">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
        <title>Web App</title>
        <script src="https://telegram.org/js/telegram-web-app.js"></script>
        <style>
            :root {
                --primary: #2481cc;
                --bg: var(--tg-theme-bg-color, #ffffff);
                --secondary-bg: var(--tg-theme-secondary-bg-color, #f4f4f7);
                --text: var(--tg-theme-text-color, #222222);
                --hint: var(--tg-theme-hint-color, #999999);
                --btn-bg: var(--tg-theme-button-color, #2481cc);
                --btn-text: var(--tg-theme-button-text-color, #ffffff);
                --success: #34c759;
                --error: #eb4034;
                --radius: 14px;
            }

            body {
                font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
                background-color: var(--bg);
                color: var(--text);
                margin: 0;
                display: flex;
                justify-content: center;
                align-items: center;
                height: 100dvh;
                -webkit-font-smoothing: antialiased;
            }

            .card {
                width: 100%;
                max-width: 400px;
                padding: 32px 24px;
                box-sizing: border-box;
                text-align: center;
                transition: all 0.3s ease;
            }

            .logo-container {
                width: 80px;
                height: 80px;
                background: var(--secondary-bg);
                border-radius: 22px;
                margin: 0 auto 20px;
                display: flex;
                align-items: center;
                justify-content: center;
                overflow: hidden;
            }

            .logo-img {
                width: 50px;
                height: 50px;
                object-fit: contain;
            }

            h2 { margin: 0 0 8px 0; font-size: 24px; font-weight: 700; }
            p { color: var(--hint); font-size: 15px; margin: 0 0 32px 0; line-height: 1.4; }

            .input-group { text-align: left; margin-bottom: 16px; position: relative; }

            label {
                display: block;
                font-size: 12px;
                font-weight: 600;
                margin-bottom: 8px;
                margin-left: 4px;
                color: var(--hint);
                text-transform: uppercase;
                letter-spacing: 0.5px;
            }

            input {
                width: 100%;
                padding: 14px 16px;
                border: 1px solid transparent;
                border-radius: var(--radius);
                background-color: var(--secondary-bg);
                color: var(--text);
                font-size: 16px;
                box-sizing: border-box;
                transition: all 0.2s ease;
            }

            input:focus { border-color: var(--primary); outline: none; background-color: var(--bg); box-shadow: 0 0 0 4px rgba(36, 129, 204, 0.1); }

            button {
                width: 100%;
                padding: 16px;
                background-color: var(--btn-bg);
                color: var(--btn-text);
                border: none;
                border-radius: var(--radius);
                font-size: 16px;
                font-weight: 600;
                cursor: pointer;
                margin-top: 8px;
                transition: opacity 0.2s;
            }

            button:active { opacity: 0.8; }

            button.secondary { background: none; color: var(--primary); margin-top: 12px; font-size: 14px; }

            .hidden { display: none; }

            .loader {
                border: 3px solid var(--secondary-bg);
                border-top: 3px solid var(--primary);
                border-radius: 50%;
                width: 32px;
                height: 32px;
                animation: spin 0.8s linear infinite;
                margin: 20px auto;
            }

            .success-icon {
                font-size: 60px;
                color: var(--success);
                margin-bottom: 20px;
            }

            @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }

            .fade-in { animation: fadeIn 0.3s ease; }
            @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
        </style>
    </head>
    <body>
        <div class="card">
            <div class="logo-container">
                <img id="app-logo" src="" alt="Logo" class="logo-img">
            </div>
            <h2 id="title"></h2>
            <p id="description"></p>

            <div id="step-loading"><div class="loader"></div></div>

            <div id="step-success" class="hidden fade-in">
                <div class="success-icon">✓</div>
                <h2 id="success-title"></h2>
            </div>

            <div id="step-user" class="hidden fade-in">
                <div class="input-group">
                    <label id="label-user"></label>
                    <input type="text" id="username" placeholder="${language == 'es' ? 'Usuario' : 'Username'}">
                </div>
                <button id="nextBtn"></button>
            </div>

            <div id="step-login" class="hidden fade-in">
                <div class="input-group">
                    <label id="label-pass"></label>
                    <input type="password" id="password" placeholder="••••••••">
                </div>
                <button id="loginBtn"></button>
                <button id="backToUserBtn" class="secondary"></button>
            </div>

            <div id="step-set" class="hidden fade-in">
                <div class="input-group">
                    <label id="label-new-pass"></label>
                    <input type="password" id="new_pass" placeholder="••••••••">
                </div>
                <div class="input-group">
                    <label id="label-rep-pass"></label>
                    <input type="password" id="repeat_pass" placeholder="••••••••">
                </div>
                <button id="setBtn"></button>
            </div>

            <div id="step-logout" class="hidden fade-in">
                <button id="confirmLogoutBtn"></button>
                <button onclick="tg.close()" id="cancelBtn" class="secondary"></button>
            </div>

            <div id="step-inactive" class="hidden fade-in">
                <p style="color: var(--error)" id="suspended-msg"></p>
                <button onclick="location.reload()" id="retryBtn"></button>
            </div>
        </div>

        <script>
            const tg = window.Telegram.WebApp;
            const WEBHOOK_URL = '${webhook}';

            const params = new URLSearchParams(window.location.search);
            const config = {
                name: '${name}',
                logo: '${logo}',
                lang: '${language}'
            };

            const i18n = {
                en: {
                    loading: "Loading...",
                    user: "Username",
                    pass: "Password",
                    next: "Next",
                    enter: "Sign In",
                    back: "Use another account",
                    new_pass: "New Password",
                    rep_pass: "Confirm Password",
                    save: "Save Password",
                    logout_q: "Log Out?",
                    logout_d: "Are you sure you want to end the session?",
                    logout_b: "Yes, log out",
                    cancel: "Cancel",
                    suspended: "Your account has been suspended.",
                    retry: "Retry",
                    alert_user: "Please enter a username",
                    alert_match: "Passwords do not match",
                    alert_error: "Connection error",
                    user_not_found: "User not found",
                    success_login: "Login Successful",
                    success_save: "Password Saved",
                    success_logout: "Logged Out"
                },
                es: {
                    loading: "Cargando...",
                    user: "Usuario",
                    pass: "Contraseña",
                    next: "Siguiente",
                    enter: "Entrar",
                    back: "Usar otro usuario",
                    new_pass: "Nueva Contraseña",
                    rep_pass: "Repetir Contraseña",
                    save: "Guardar Contraseña",
                    logout_q: "¿Cerrar Sesión?",
                    logout_d: "¿Deseas salir de la sesión activa?",
                    logout_b: "Sí, cerrar sesión",
                    cancel: "Cancelar",
                    suspended: "Tu cuenta ha sido suspendida.",
                    retry: "Reintentar",
                    alert_user: "Ingresa un usuario",
                    alert_match: "No coinciden",
                    alert_error: "Error de conexión",
                    user_not_found: "Usuario no encontrado",
                    success_login: "Inicio de sesión exitoso",
                    success_save: "Contraseña guardada",
                    success_logout: "Sesión cerrada"
                }
            };

            const t = i18n[config.lang] || i18n.en;
            let currentUser = "";

            document.getElementById('app-logo').src = config.logo;
            document.getElementById('label-user').innerText = t.user;
            document.getElementById('label-pass').innerText = t.pass;
            document.getElementById('label-new-pass').innerText = t.new_pass;
            document.getElementById('label-rep-pass').innerText = t.rep_pass;
            document.getElementById('nextBtn').innerText = t.next;
            document.getElementById('loginBtn').innerText = t.enter;
            document.getElementById('backToUserBtn').innerText = t.back;
            document.getElementById('setBtn').innerText = t.save;
            document.getElementById('confirmLogoutBtn').innerText = t.logout_b;
            document.getElementById('cancelBtn').innerText = t.cancel;
            document.getElementById('suspended-msg').innerText = t.suspended;
            document.getElementById('retryBtn').innerText = t.retry;

            tg.expand();
            tg.ready();

            const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));

            async function apiCall(payload) {
                try {
                    const response = await fetch(WEBHOOK_URL, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ ...payload, chat_id: tg.initDataUnsafe.user?.id })
                    });
                    return await response.json();
                } catch (e) {
                    tg.showAlert(t.alert_error);
                    return null;
                }
            }

            async function initApp() {
                const res = await apiCall({ action: "init" });
                if (!res) return;

                if (res.status === "relogin") {
                    currentUser = res.username;
                    showStep("step-login", config.name, res.username);
                } else if (res.status === "logout") {
                    showStep("step-logout", t.logout_q, t.logout_d);
                } else {
                    showStep("step-user", config.name, "");
                }
            }

            document.getElementById('nextBtn').addEventListener('click', async () => {
                const user = document.getElementById('username').value.trim();
                if (!user) return tg.showAlert(t.alert_user);
                const res = await apiCall({ action: "check_user", user });
                if (!res) return;
                currentUser = user;
                if (res.status === "ask") showStep("step-login", config.name, t.pass);
                else if (res.status === "set") showStep("step-set", t.new_pass, "");
                else if (res.status === "inactive") showStep("step-inactive", config.name, "");
                else tg.showAlert(t.user_not_found);
            });

            document.getElementById('loginBtn').addEventListener('click', async () => {
                const pass = document.getElementById('password').value;
                const res = await apiCall({ action: "login", user: currentUser, pass });
                if (res?.status === "ok") {
                    tg.sendData(JSON.stringify({ action: "login_success", user: currentUser }));
                    showStep("step-success", "", "");
                    document.getElementById("success-title").innerText = t.success_login;
                    await wait(3000);
                    tg.close();
                } else tg.showAlert(res?.message || "Error");
            });

            document.getElementById('setBtn').addEventListener('click', async () => {
                const p1 = document.getElementById('new_pass').value;
                if (p1 !== document.getElementById('repeat_pass').value) return tg.showAlert(t.alert_match);
                const res = await apiCall({ action: "new_password", user: currentUser, pass: p1 });
                if (res?.status === "ok") {
                    tg.sendData(JSON.stringify({ action: "setup_success", user: currentUser }));
                    showStep("step-success", "", "");
                    document.getElementById("success-title").innerText = t.success_save;
                    await wait(3000);
                    tg.close();
                } else tg.showAlert("Error");
            });

            document.getElementById('confirmLogoutBtn').addEventListener('click', async () => {
                await apiCall({ action: "logout_confirm" });
                tg.sendData(JSON.stringify({ action: "logout_success" }));
                showStep("step-success", "", "");
                document.getElementById("success-title").innerText = t.success_logout;
                await wait(3000);
                tg.close();
            });

            document.getElementById('backToUserBtn').addEventListener('click', () => {
                showStep("step-user", config.name, "");
            });

            function showStep(stepId, title, desc) {
                ["step-loading", "step-user", "step-login", "step-set", "step-logout", "step-inactive", "step-success"].forEach(s => {
                    document.getElementById(s).classList.add('hidden');
                });
                document.getElementById(stepId).classList.remove('hidden');
                if(title || desc) {
                    document.getElementById('title').innerText = title;
                    document.getElementById('description').innerText = desc;
                    document.getElementById('title').classList.remove('hidden');
                    document.getElementById('description').classList.remove('hidden');
                } else {
                    document.getElementById('title').classList.add('hidden');
                    document.getElementById('description').classList.add('hidden');
                }
            }

            initApp();
        </script>
    </body>
    </html>
`;
}
