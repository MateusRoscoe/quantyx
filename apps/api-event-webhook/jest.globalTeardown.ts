export default async function () {
  if (globalThis.__KAFKA_CONTAINER__) {
    await globalThis.__KAFKA_CONTAINER__.stop();
  }
}
