import { defineConfig } from "orval";

export default defineConfig({
  teknotip: {
    input: {
      target: "http://localhost:8080/api/v3/api-docs",
    },
    output: {
      mode: "tags-split",
      client: "fetch",
      target: "lib/api/generated/endpoints",
      schemas: "lib/api/generated/model",
      clean: true,
      baseUrl: "/backend",
      override: {
        mutator: {
          path: "./lib/api/fetcher.ts",
          name: "customFetch",
        },
        fetch: {
          includeHttpResponseReturnType: true,
        },
      },
    },
  },
});
