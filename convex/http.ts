import { httpRouter } from "convex/server";
import { githubCallback } from "./auth";

const http = httpRouter();

http.route({
  path: "/auth/github/callback",
  method: "GET",
  handler: githubCallback,
});

export default http;
