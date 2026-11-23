import { execSync } from "node:child_process";
import { expect, test, type Browser, type Page } from "@playwright/test";

const PASSWORD = process.env.DEMO_PASSWORD ?? "Demo!E2e-Luanda26";
const SHIPPER = "logistica@kwanza.demo.agff.ao";
const DRIVER = "ld-24-61-aa@demo.agff.ao";
const PORT_OF_LUANDA = { latitude: -8.806, longitude: 13.247 };

test.beforeAll(() => {
  execSync("npx tsx prisma/seed-demo.ts", { env: { ...process.env, DEMO_PASSWORD: PASSWORD }, stdio: "inherit" });
});

async function loginAs(browser: Browser, email: string): Promise<Page> {
  const context = await browser.newContext({
    locale: "pt-PT",
    permissions: ["geolocation"],
    geolocation: PORT_OF_LUANDA,
  });
  const page = await context.newPage();
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(PASSWORD);
  await page.getByRole("button", { name: "Entrar" }).click();
  await page.waitForURL((url) => !url.pathname.startsWith("/login"));
  return page;
}

test("frete imediato: preço fixo → motorista mais próximo aceita → entrega com código → avaliação", async ({
  browser,
}) => {
  const shipper = await loginAs(browser, SHIPPER);
  await shipper.goto("/app/freight");
  await shipper.getByLabel("Recolha — Local").selectOption("LUANDA_PORT");
  await shipper.getByLabel("Entrega — Local").selectOption("VIANA");
  await shipper.locator("input[name=category][value=CONTAINER_TRUCK]").check();
  await shipper.locator("input[name=cargoDescription]").fill("Contentor 20' — e2e");
  await expect(shipper.getByTestId("odf-total")).toContainText(/\d/);
  await shipper.getByRole("button", { name: "Solicitar Frete Imediato" }).click();
  await shipper.waitForURL(/\/app\/freight\/[^/]+$/);
  await expect(shipper.getByText("A procurar motorista").first()).toBeVisible();

  const driver = await loginAs(browser, DRIVER);
  await driver.goto("/app/driver");
  await expect(driver.getByText("Nova oferta de carga")).toBeVisible();
  await expect(driver.getByText("Contentor 20' — e2e")).toBeVisible();
  await driver.getByRole("button", { name: "Aceitar" }).click();
  await expect(driver.getByText("Corrida actual")).toBeVisible();

  await shipper.reload();
  await expect(shipper.getByText("Motorista a caminho").first()).toBeVisible();
  await expect(shipper.getByText("Manuel Kiala")).toBeVisible();
  await expect(shipper.getByText("Preço fixo", { exact: true }).locator("..")).toHaveCSS(
    "background-color",
    "rgb(11, 29, 58)",
  );
  const code = (await shipper.getByTestId("odf-delivery-code").innerText()).trim();
  expect(code).toMatch(/^\d{6}$/);

  await driver.getByRole("button", { name: "Cheguei à recolha" }).click();
  await driver.getByRole("button", { name: "Carga recolhida — iniciar viagem" }).click();
  await driver.getByLabel("Código de entrega do expedidor").fill(code === "000000" ? "111111" : "000000");
  await driver.getByRole("button", { name: "Confirmar entrega" }).click();
  await expect(driver.getByText("Código de entrega errado.")).toBeVisible();
  await expect(driver.getByLabel("Código de entrega do expedidor")).toHaveValue("");
  await driver.getByLabel("Código de entrega do expedidor").fill(code);
  await driver.getByRole("button", { name: "Confirmar entrega" }).click();
  await expect(driver.getByText("À espera de pedidos perto de si…")).toBeVisible();

  await shipper.reload();
  await expect(shipper.getByText("Entregue").first()).toBeVisible();
  await shipper.getByLabel("Avaliação (1–5)").selectOption("5");
  await shipper.getByRole("button", { name: "Avaliar" }).click();
  await expect(shipper.getByText("Avaliado com 5/5")).toBeVisible();
});
