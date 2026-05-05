import { defineConfig } from "orval";

const swaggerTarget =
  process.env.ORVAL_SWAGGER_URL ?? "https://api.tickx.finance/swagger/json";

export default defineConfig({
  api: {
    output: {
      mode: "split",
      target: "src/services/queries.ts",
      schemas: "src/services/models",
      client: "react-query",
      override: {
        mutator: {
          path: "src/services/custom-client.ts",
          name: "customClient",
        },
        query: {
          options: {
            staleTime: 10000,
          },
        },
      },
    },
    input: {
      target: swaggerTarget,
    },
  },
});
