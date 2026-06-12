// js/utils.js — 工具函数
const Utils = {
  genId() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  },

  today() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  },

  nowTime() {
    const d = new Date();
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  },

  now() {
    return `${this.today()} ${this.nowTime()}`;
  },

  formatMoney(amount) {
    return '¥' + Number(amount).toFixed(2);
  },

  todayDisplay() {
    const d = new Date();
    const weekDays = ['日', '一', '二', '三', '四', '五', '六'];
    return `${this.today()} 星期${weekDays[d.getDay()]}`;
  },

  defaultCategories: [
    { id: 'cat_main', name: '主菜', sortOrder: 1 },
    { id: 'cat_side', name: '配菜', sortOrder: 2 },
    { id: 'cat_fry', name: '炒菜', sortOrder: 3 },
    { id: 'cat_drink', name: '酒水', sortOrder: 4 },
    { id: 'cat_other', name: '其他', sortOrder: 5 }
  ],

  defaultDishes: [
    { categoryId: 'cat_main', name: '连鱼', priceType: 'per_jin', unitPrice: 38 },
    { categoryId: 'cat_main', name: '鲤鱼', priceType: 'per_jin', unitPrice: 25 },
    { categoryId: 'cat_main', name: '草鱼', priceType: 'per_jin', unitPrice: 28 },
    { categoryId: 'cat_main', name: '鸡', priceType: 'per_jin', unitPrice: 35 },
    { categoryId: 'cat_side', name: '豆腐', priceType: 'per_serving', unitPrice: 12 },
    { categoryId: 'cat_side', name: '白菜', priceType: 'per_serving', unitPrice: 8 },
    { categoryId: 'cat_side', name: '土豆', priceType: 'per_serving', unitPrice: 10 }
  ],

  async initDefaultData() {
    const inited = await DB.getMeta('data_inited');
    if (inited) return;
    for (const cat of this.defaultCategories) {
      await DB.put('dishes', { ...cat, _type: 'category' });
    }
    for (const dish of this.defaultDishes) {
      await DB.put('dishes', {
        ...dish, id: this.genId(), available: true, _type: 'dish', createdAt: this.now()
      });
    }
    await DB.setMeta('data_inited', true);
  },

  async exportData() {
    const dishes = await DB.getAll('dishes');
    const orders = await DB.getAll('orders');
    const blob = new Blob(
      [JSON.stringify({ dishes, orders, exportedAt: this.now() }, null, 2)],
      { type: 'application/json' }
    );
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `点餐数据备份_${this.today()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  },

  statusLabel(status) {
    const map = { pending: '待处理', cooking: '制作中', done: '已完成', paid: '已付款' };
    return map[status] || status;
  }
};
