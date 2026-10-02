// 新規作成のひな形(公開前の「準備中」。サーバーと同じ検証を通る形)
export function newProductTemplate() {
  return JSON.stringify(
    {
      id: "new-product",
      category: "tool",
      title: "新しいプロダクト",
      description: "ここに説明を書きます。",
      tags: [],
      featured: false,
      details: [],
      image: null,
      screenshots: [],
      platforms: ["web"],
      requirements: [],
      storage: ["none"],
      price: { type: "free" },
      plan: { free: ["すべての機能を、無料で使えます"], paid: [] },
      status: "coming-soon",
      url: "/",
      detail_path: null,
      cta: "準備中",
      download: null,
      purchase: null,
      version: "0.1.0",
      released_at: null,
      updated_at: new Date().toISOString().slice(0, 10),
      faq: [],
      changelog: [],
    },
    null,
    2,
  );
}
