import { expect, test, type Page } from "@playwright/test";

const MAILPIT = process.env.MAILPIT_URL ?? "http://localhost:8025";
const SUPERADMIN_EMAIL = process.env.SEED_SUPERADMIN_EMAIL ?? "admin@agff.local";
const SUPERADMIN_PASSWORD = process.env.SEED_SUPERADMIN_PASSWORD ?? "ChangeMe!2026";
const PASSWORD = "Sup3rSecret!pw";

async function login(page: Page, email: string, password: string) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Entrar" }).click();
  await page.waitForURL((url) => !url.pathname.startsWith("/login"));
}

async function logout(page: Page) {
  await page.getByRole("button", { name: "Terminar sessão" }).click();
  await expect(page).toHaveURL(/\/login/);
}

async function inviteLinkFor(email: string): Promise<string> {
  for (let i = 0; i < 20; i++) {
    const res = await fetch(`${MAILPIT}/api/v1/search?query=${encodeURIComponent(`to:${email}`)}`);
    const { messages } = (await res.json()) as { messages: { ID: string }[] };
    if (messages?.length) {
      const msg = (await (await fetch(`${MAILPIT}/api/v1/message/${messages[0].ID}`)).json()) as { Text: string };
      const link = msg.Text.match(/https?:\/\/\S+\/invite\/[A-Za-z0-9_-]+/)?.[0];
      if (link) return new URL(link).pathname;
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`invite email for ${email} not found`);
}

test("landing pública em pt-PT", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Toda a cadeia logística numa só plataforma" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Registar empresa" }).first()).toBeVisible();
});

test("rotas protegidas exigem sessão", async ({ page }) => {
  await page.goto("/app");
  await expect(page).toHaveURL(/\/login/);
  await page.goto("/admin");
  await expect(page).toHaveURL(/\/login/);
});

test("empresa regista-se → admin aprova → convite → login do convidado", async ({ page }) => {
  const id = Date.now();
  const company = `Logística E2E ${id}`;
  const adminEmail = `admin.${id}@e2e.test`;
  const inviteeEmail = `gestor.${id}@e2e.test`;

  // 1. Registo
  await page.goto("/register");
  await page.getByLabel("Nome comercial").fill(company);
  await page.getByLabel("Denominação social").fill(`${company} Lda`);
  await page.getByLabel("NIF").fill(`E2E${id}`);
  await page.getByLabel("Email da empresa").fill(`geral.${id}@e2e.test`);
  await page.getByLabel("Nome completo").fill("Administradora E2E");
  await page.getByLabel("Email pessoal").fill(adminEmail);
  await page.getByLabel("Password", { exact: true }).fill(PASSWORD);
  await page.getByLabel("Aceito os termos").check();
  await page.getByRole("button", { name: "Registar" }).click();
  await expect(page).toHaveURL(/\/app\/pending/);
  await expect(page.getByText("aguarda aprovação")).toBeVisible();

  // Sem aprovação, o servidor bloqueia o módulo de equipa
  await page.goto("/app/team");
  await expect(page).toHaveURL(/\/app\/pending/);
  await logout(page);

  // 2. Super Administrator aprova
  await login(page, SUPERADMIN_EMAIL, SUPERADMIN_PASSWORD);
  await expect(page).toHaveURL(/\/app/);
  await page.goto(`/admin?q=${encodeURIComponent(company)}`);
  await page.getByRole("link", { name: company }).click();
  await page.getByRole("button", { name: "Aprovar" }).click();
  await expect(page.getByText("ACTIVE").or(page.getByText("Activa")).first()).toBeVisible();
  await logout(page);

  // 3. Company Administrator convida um Logistics Manager
  await login(page, adminEmail, PASSWORD);
  await page.goto("/app/team");
  await page.getByLabel("Email").fill(inviteeEmail);
  await page.getByLabel("Perfil").selectOption("LOGISTICS_MANAGER");
  await page.getByRole("button", { name: "Enviar convite" }).click();
  await expect(page.getByText(inviteeEmail)).toBeVisible();

  // RBAC: um admin de empresa não entra no painel da plataforma
  await page.goto("/admin");
  await expect(page).toHaveURL(/\/app\/forbidden/);
  await logout(page);

  // 4. Convidado aceita e entra
  await page.goto(await inviteLinkFor(inviteeEmail));
  await page.getByLabel("Nome completo").fill("Gestor E2E");
  await page.getByLabel("Password", { exact: true }).fill(PASSWORD);
  await page.getByRole("button", { name: "Criar conta" }).click();
  await expect(page).toHaveURL(/\/app$/);
  await expect(page.getByText(company).first()).toBeVisible();

  // Logistics Manager não acede à auditoria da empresa
  await page.goto("/app/audit");
  await expect(page).toHaveURL(/\/app\/forbidden/);
});
