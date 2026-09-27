// Web Push VAPID 키쌍(P-256) 생성 — 화면 출력만 한다.
//
//   node scripts/gen_vapid_keys.mjs
//
// 비밀키는 **파일로 쓰지 않고 레포에도 남기지 않는다**. 출력된 값을 Cloudflare 대시보드
// (mir-push 워커 → Settings → Variables and Secrets)에 Secret 으로 바로 붙여넣고 터미널을 닫을 것.
// 공개키는 비밀이 아니다 — 워커 Secret VAPID_PUBLIC_KEY 와 프런트 web-push.js 의
// MIR_PUSH_DEFAULTS.vapidPublicKey 두 곳에 같은 값을 넣는다(DEPLOY.md "Web Push 알림 워커").
//
// 키를 바꾸면 기존 구독이 전부 무효가 된다(브라우저 구독은 공개키에 묶여 있다) — 사용자는 사이트에서
// 알림을 한 번 끄고 다시 켜야 한다. 유출이 아니면 바꾸지 말 것.
import { webcrypto } from "node:crypto";

const subtle = (globalThis.crypto || webcrypto).subtle;

function b64url(bytes) {
  return Buffer.from(bytes).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

const pair = await subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, ["sign", "verify"]);
const publicRaw = new Uint8Array(await subtle.exportKey("raw", pair.publicKey));
const jwk = await subtle.exportKey("jwk", pair.privateKey);

// 한 번 서명·검증해 키쌍이 맞는지 확인하고 출력한다.
const probe = new TextEncoder().encode("mir-vapid-selftest");
const sig = await subtle.sign({ name: "ECDSA", hash: "SHA-256" }, pair.privateKey, probe);
if (!(await subtle.verify({ name: "ECDSA", hash: "SHA-256" }, pair.publicKey, sig, probe))) {
  console.error("키쌍 자체 검증 실패 — 다시 실행하세요.");
  process.exit(1);
}

console.log("VAPID 키쌍 (P-256). 비밀키는 이 화면에만 있습니다 — 파일로 저장하지 마세요.\n");
console.log(`VAPID_PUBLIC_KEY=${b64url(publicRaw)}`);
console.log(`VAPID_PRIVATE_KEY=${jwk.d}`);
console.log("\n다음 단계:");
console.log("  1) mir-push 워커 → Settings → Variables and Secrets → Secret 으로 두 값 추가(+ VAPID_SUBJECT=mailto:본인메일)");
console.log("  2) web-push.js 의 MIR_PUSH_DEFAULTS.vapidPublicKey 에 공개키(VAPID_PUBLIC_KEY 값)만 넣고 PR");
