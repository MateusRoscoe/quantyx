export default async function () {
  if (globalThis.__POSTGRES_CONTAINER__) {
    await globalThis.__POSTGRES_CONTAINER__.stop();
  }
}
