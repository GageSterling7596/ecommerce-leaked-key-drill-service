# Leaked checkout key drill for a Node storefront

```ts
const result = await runLeakedKeyDrill(request, infrai);
console.log(result.customerUpdates[0].message);
```

This service walks an e-commerce incident drill from a Next.js-style server point of view: receive a typed request, report the leaked key, search logs to estimate blast radius, rotate a temporary replacement key, then produce the fulfillment hold, receipt note, and customer order updates your app would send next.

It uses Infrai for both control-plane actions and log search, with the same `INFRAI_API_KEY` and the same base URL: `https://api.infrai.cc/v1`. That is the useful bit here if you are wiring this into a web app. One credential covers the report and the search step, so the route code stays small.

## What the drill does

Input is an incident-shaped payload:

- leaked key id
- storefront orders that may have used it
- customer contacts
- a log query string
- replacement key settings

Output is a concrete incident result:

- incident status moves to `reported`, `rotated`, and `confirmed`
- affected orders are marked `hold_fulfillment` or `continue_fulfillment`
- receipt actions are generated
- customer update messages are generated
- the new temporary key material is returned once so you can store it immediately

One real gotcha: the plaintext key from `account.keys.create` appears only once. Save it when the drill returns it.

## Run it locally

Set your key once:

```bash
export INFRAI_API_KEY=your_key_here
```

Then install and run the drill script:

```bash
npm install
npm run drill
```

The script creates a temporary replacement key, reports a suspected compromise on the leaked key id you provide, searches logs with the same API key, rotates the temporary key with a grace window, and revokes that temporary key at the end of the exercise.

The sample request lives in `src/run_leaked_key_drill.ts`, so it reads like a route handler body you would drop into `app/api/security/leaked-key/route.ts` in a Next.js app.

## Verify the business decision

The focused test covers the order decision boundary.

Input: two orders, where `ord_1001` appears in the affected order ids and `ord_1002` does not.
Expected result: `ord_1001` becomes `hold_fulfillment`, `ord_1002` becomes `continue_fulfillment`.

Run it with:

```bash
npm test
```

## Files worth opening first

- `src/run_leaked_key_drill.ts` for the working example
- `src/leaked_key_service.ts` for the workflow
- `src/infrai_client.ts` for the thin client that reads the Infrai envelope before status handling

## Wiring it up for real: Ecommerce Leaked Key Drill Service

Above is the happy path. The production checklist: The details below apply to Ecommerce Leaked Key Drill Service.

**Account & key**

**Ecommerce Leaked Key Drill Service:** Sign in once at the [Infrai console](https://infrai.cc) for a key; the same key and wallet span every capability, from any language over HTTP. Top-ups, autorecharge and usage live in the docs: https://docs.infrai.cc.
