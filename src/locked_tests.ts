import "dotenv/config";
import axios from "axios";

const adminPassword = process.env["SESSION_PASSWORD"];
const base = "http://localhost:8000";

async function createSession(allow_locked: boolean): Promise<string> {
  const res = await axios.post(
    `${base}/session/create?allow_locked=${allow_locked}`,
    {},
    { headers: { "admin-session": adminPassword } }
  );

  return res.data.id;
}

function withSession(url: string, smid: string) {
  const sep = url.includes("?") ? "&" : "?";
  return `${url}${sep}smid=${smid}`;
}

async function run() {
  console.log("Creating sessions...");

  const unlockedSession = await createSession(false);
  const lockedSession = await createSession(true);

  console.log("Fetching all photos...");

  const unlockedPhotos = (
    await axios.get(withSession(`${base}/images`, unlockedSession))
  ).data;

  const lockedPhotos = (
    await axios.get(withSession(`${base}/images`, lockedSession))
  ).data;

  console.log(`Unlocked: ${unlockedPhotos.length}`);
  console.log(`Locked: ${lockedPhotos.length}`);

  if (lockedPhotos.length < unlockedPhotos.length) {
    console.error("❌ Locked session sees fewer photos");
  } else {
    console.log("✅ Locked visibility OK");
  }

  const lockedOnly = lockedPhotos.find(
    (p: any) => !unlockedPhotos.some((u: any) => u.id === p.id)
  );

  if (!lockedOnly) {
    console.warn("⚠️ No locked-only images found");
    return;
  }

  console.log("Locked-only image:", lockedOnly.id);

  // =========================
  // 🔒 ACCESS TESTS
  // =========================

  async function expect404(url: string) {
    try {
      await axios.get(url);
      console.error("❌ Expected 404 but succeeded:", url);
    } catch (e: any) {
      if (e.response?.status === 404) {
        console.log("✅ 404 as expected:", url);
      } else {
        console.error("❌ Unexpected status:", e.response?.status, url);
      }
    }
  }

  async function expect200(url: string) {
    try {
      const res = await axios.get(url);
      if (res.status === 200) {
        console.log("✅ 200 OK:", url);
      } else {
        console.error("❌ Not 200:", url);
      }
    } catch {
      console.error("❌ Request failed:", url);
    }
  }

  await expect404(
    withSession(`${base}/images/${lockedOnly.id}/details`, unlockedSession)
  );

  await expect404(
    withSession(`${base}/images/${lockedOnly.id}/view`, unlockedSession)
  );

  await expect404(
    withSession(`${base}/images/${lockedOnly.id}/exif`, unlockedSession)
  );

  await expect200(
    withSession(`${base}/images/details/${lockedOnly.id}`, lockedSession)
  );

  // =========================
  // 🎲 RANDOM ENDPOINT (BUG TEST)
  // =========================

  console.log("Testing /random for leaks...");

  for (let i = 0; i < 10; i++) {
    const res = await axios.get(withSession(`${base}/random`, unlockedSession));

    if (res.data && res.data.id === lockedOnly.id) {
      console.error("❌ /random leaked locked image!");
      break;
    }
  }

  console.log("✅ Random test complete");

  // =========================
  // 🔍 SEARCH TEST
  // =========================

  console.log("Testing search...");

  const searchUnlocked = (
    await axios.get(
      withSession(`${base}/image-search?search= `, unlockedSession)
    )
  ).data;

  if (searchUnlocked.some((p: any) => p.id === lockedOnly.id)) {
    console.error("❌ Search leaked locked image!");
  } else {
    console.log("✅ Search respects locked");
  }

  // =========================
  // 🏷️ TAG TESTS
  // =========================

  const tags = (await axios.get(withSession(`${base}/tags`, lockedSession)))
    .data;

  if (tags.length > 0) {
    const tag = tags[0];

    const unlockedTagPhotos = (
      await axios.get(
        withSession(`${base}/images/${tag.name}`, unlockedSession)
      )
    ).data;

    const lockedTagPhotos = (
      await axios.get(withSession(`${base}/images/${tag.name}`, lockedSession))
    ).data;

    if (lockedTagPhotos.length < unlockedTagPhotos.length) {
      console.error("❌ Tag filtering broken");
    } else {
      console.log("✅ Tag filtering OK");
    }
  }

  console.log("Verifying no locked tags leak...");

  for (const photo of unlockedPhotos) {
    if (photo.tags?.length) {
      const lockedTag = tags.find(
        (t: any) => photo.tags.includes(t.id) && t.is_locked
      );

      if (lockedTag) {
        console.error("❌ Locked tag leaked into photo!", photo.id);
      }
    }
  }

  // =========================
  // 🚫 INVALID SESSION
  // =========================

  console.log("Testing invalid session...");

  try {
    await axios.get(`${base}/images?smid=invalid`);
    console.error("❌ Invalid session was accepted!");
  } catch {
    console.log("✅ Invalid session rejected");
  }

  // =========================
  // 🛠️ ADMIN PROTECTION
  // =========================

  // console.log("Testing admin protection...");

  // try {
  //   await axios.delete(withSession(`${base}/images`, unlockedSession), {
  //     data: { images: [lockedOnly.id] },
  //   });
  //   console.error("❌ Non-admin was able to delete!");
  // } catch {
  //   console.log("✅ Admin protection works");
  // }

  // =========================
  // 🧪 INPUT VALIDATION
  // =========================

  console.log("Testing validation...");

  try {
    await axios.get(
      withSession(`${base}/images/not-a-number/view`, unlockedSession)
    );
    console.error("❌ Invalid ID accepted!");
  } catch {
    console.log("✅ Invalid ID rejected");
  }

  // =========================
  // 🏷️ TAG CREATION DUPLICATE
  // =========================

  console.log("Testing duplicate tag...");

  if (tags.length > 0) {
    const tagName = tags[0].name;

    try {
      await axios.post(withSession(`${base}/tags/${tagName}`, unlockedSession));
      console.error("❌ Duplicate tag allowed!");
    } catch {
      console.log("✅ Duplicate tag rejected");
    }
  }

  console.log("🎉 ALL TESTS DONE");
}

run();
