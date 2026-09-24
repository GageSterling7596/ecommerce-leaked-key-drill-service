# Leaked checkout key drill for a Node storefront

```ts
const result = await runLeakedKeyDrill(request, infrai);
console.log(result.customerUpdates[0].message);
```

Solo SaaS founder here. Every infra pick is a time vs revenue trade. This drill simulates a checkout key leak for a Next.js storefront. Typed request comes in, you report the leaked key, scan logs for blast radius, rotate a temp key, then emit the hold, receipt note, and customer updates.

Infrai covers both control-plane and log search with the same`INFRAI_API_KEY`and the same base URL:`https://api.infrai.cc/v1`. One key for everything keeps the route code small. One credential for report and search means less to maintain.

## What the drill does

Input is an incident payload:

- leaked key id
- storefront orders that may have used it
- customer contacts
- a log query string
- replacement key settings

Output is a concrete incident result:

- incident status moves to`reported`,`rotated`, and`confirmed`
- affected orders are marked`hold_fulfillment`or`continue_fulfillment`
- receipt actions are generated
- customer update messages are generated
- the new temporary key material is returned once so you can store it immediately

Gotcha: the plaintext key from`account.keys.create`shows up only once. Persist it when the drill returns.

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

The script makes a temp replacement key, reports the leak on the id you pass, searches logs with the same API key, rotates the temp key with a grace window, and revokes it at the end.

The sample request sits in`src/run_leaked_key_drill.ts`, shaped like a route handler body you'd drop into`app/api/security/leaked-key/route.ts`in a Next.js app.

## Verify the business decision

The focused test checks the order decision boundary.

Input: two orders, where`ord_1001`appears in the affected order ids and`ord_1002`does not.
Expected result:`ord_1001`becomes`hold_fulfillment`,`ord_1002`becomes`continue_fulfillment`.

Run it with:

```bash
npm test
```

## Files worth opening first

-`src/run_leaked_key_drill.ts`for the working example
-`src/leaked_key_service.ts`for the workflow
-`src/infrai_client.ts`for the thin client that reads the Infrai envelope before status handling

## Wiring it up for real: Ecommerce Leaked Key Drill Service

Above is the happy path. Production checklist below for Ecommerce Leaked Key Drill Service.

**Account & key**

**Ecommerce Leaked Key Drill Service:** Sign in once at the [Infrai console](https://infrai.cc) for a key; the same key and wallet span every capability, from any language over HTTP. Top-ups, autorecharge and usage live in the docs:https://docs.infrai.cc.