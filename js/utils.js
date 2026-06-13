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

  // 给定一个 createdAt(YYYY-MM-DD HH:mm),返回距今分钟数
  minutesSince(timestamp) {
    if (!timestamp) return 0;
    const t = timestamp.replace(' ', 'T');
    const past = new Date(t).getTime();
    if (isNaN(past)) return 0;
    return Math.max(0, Math.floor((Date.now() - past) / 60000));
  },

  // YYYY-MM-DD 加减天数
  shiftDate(dateStr, delta) {
    const d = new Date(dateStr || this.today());
    d.setDate(d.getDate() + delta);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  },

  defaultPurchaseCategories: [
    { id: 'pc_meat', name: '肉类', sortOrder: 1 },
    { id: 'pc_veg', name: '蔬菜', sortOrder: 2 },
    { id: 'pc_fish', name: '水产', sortOrder: 3 },
    { id: 'pc_spice', name: '调料', sortOrder: 4 },
    { id: 'pc_grain', name: '粮油', sortOrder: 5 },
    { id: 'pc_drink', name: '酒水', sortOrder: 6 },
    { id: 'pc_other', name: '其他', sortOrder: 7 }
  ],

  async initPurchaseCategories() {
    let cats = await DB.getMeta('purchaseCategories');
    if (cats) return JSON.parse(cats);
    await DB.setMeta('purchaseCategories', JSON.stringify(this.defaultPurchaseCategories));
    return [...this.defaultPurchaseCategories];
  },

  async savePurchaseCategories(cats) {
    await DB.setMeta('purchaseCategories', JSON.stringify(cats));
  },

  // 默认桌号快捷标签
  defaultTableTags: ['1号桌', '2号桌', '3号桌', '4号桌', '5号桌', '6号桌', '打包', '外卖'],

  async initTableTags() {
    let tags = await DB.getMeta('tableTags');
    if (tags) return JSON.parse(tags);
    await DB.setMeta('tableTags', JSON.stringify(this.defaultTableTags));
    return [...this.defaultTableTags];
  },

  async saveTableTags(tags) {
    await DB.setMeta('tableTags', JSON.stringify(tags));
  },

  defaultCategories: [
    { id: 'cat_main', name: '主菜', sortOrder: 1 },
    { id: 'cat_side', name: '配菜', sortOrder: 2 },
    { id: 'cat_fry', name: '炒菜', sortOrder: 3 },
    { id: 'cat_drink', name: '酒水', sortOrder: 4 },
    { id: 'cat_other', name: '其他', sortOrder: 5 }
  ],

  // 默认主菜口味(给老菜品迁移用)
  defaultMainFlavors: ['酸汤', '青椒', '清汤', '鸳鸯(酸汤+青椒)', '鸳鸯(酸汤+清汤)', '鸳鸯(青椒+清汤)'],

  defaultDishes: [
    { categoryId: 'cat_main', name: '连鱼', priceType: 'per_jin', unitPrice: 60 },
    { categoryId: 'cat_main', name: '鲤鱼', priceType: 'per_jin', unitPrice: 50 },
    { categoryId: 'cat_main', name: '草鱼', priceType: 'per_jin', unitPrice: 50 },
    { categoryId: 'cat_main', name: '鸡', priceType: 'per_jin', unitPrice: 60 },
    { categoryId: 'cat_side', name: '白菜', priceType: 'per_serving', unitPrice: 8 },
    { categoryId: 'cat_side', name: '豆腐', priceType: 'per_serving', unitPrice: 10 },
    { categoryId: 'cat_side', name: '土豆', priceType: 'per_serving', unitPrice: 8 },
    { categoryId: 'cat_side', name: '虾', priceType: 'per_serving', unitPrice: 40 },
    { categoryId: 'cat_fry', name: '炒西红柿', priceType: 'per_serving', unitPrice: 15 },
    { categoryId: 'cat_fry', name: '西红柿炒鸡蛋', priceType: 'per_serving', unitPrice: 15 },
    { categoryId: 'cat_fry', name: '蛋炒饭', priceType: 'per_serving', unitPrice: 10 },
    { categoryId: 'cat_drink', name: '雪花', priceType: 'per_serving', unitPrice: 4 },
    { categoryId: 'cat_drink', name: '雪花', priceType: 'per_serving', unitPrice: 66 },
    { categoryId: 'cat_drink', name: '矿泉水', priceType: 'per_serving', unitPrice: 2 },
    { categoryId: 'cat_drink', name: '冰糖雪梨', priceType: 'per_serving', unitPrice: 4 },
    { categoryId: 'cat_drink', name: '红牛', priceType: 'per_serving', unitPrice: 6 },
    { categoryId: 'cat_drink', name: '白酒', priceType: 'per_jin', unitPrice: 25 },
    { categoryId: 'cat_drink', name: '大可乐', priceType: 'per_serving', unitPrice: 10 },
    { categoryId: 'cat_drink', name: '椰子奶', priceType: 'per_serving', unitPrice: 18 },
    { categoryId: 'cat_drink', name: '苏打水', priceType: 'per_serving', unitPrice: 3 },
    { categoryId: 'cat_drink', name: '水溶CCOO', priceType: 'per_serving', unitPrice: 6 },
    { categoryId: 'cat_drink', name: 'C维他命水', priceType: 'per_serving', unitPrice: 6 },
    { categoryId: 'cat_drink', name: '东方树叶', priceType: 'per_serving', unitPrice: 6 },
    { categoryId: 'cat_drink', name: '茶π（大）', priceType: 'per_serving', unitPrice: 8 },
    { categoryId: 'cat_drink', name: '尖叫', priceType: 'per_serving', unitPrice: 5 },
    { categoryId: 'cat_drink', name: '橙心橙意', priceType: 'per_serving', unitPrice: 18 },
    { categoryId: 'cat_drink', name: '雪碧（小）', priceType: 'per_serving', unitPrice: 3 },
    { categoryId: 'cat_drink', name: '可乐（小）', priceType: 'per_serving', unitPrice: 3 },
    { categoryId: 'cat_drink', name: '芬达', priceType: 'per_serving', unitPrice: 4 },
    { categoryId: 'cat_drink', name: '美汁源', priceType: 'per_serving', unitPrice: 4 },
    { categoryId: 'cat_drink', name: '维生素C', priceType: 'per_serving', unitPrice: 5 },
    { categoryId: 'cat_drink', name: '雪碧（罐装）', priceType: 'per_serving', unitPrice: 5 },
    { categoryId: 'cat_drink', name: '芬达（罐装）', priceType: 'per_serving', unitPrice: 5 },
    { categoryId: 'cat_drink', name: '雪碧（大）', priceType: 'per_serving', unitPrice: 10 },
    { categoryId: 'cat_other', name: '蒸鱼（辣）', priceType: 'per_serving', unitPrice: 0 },
    { categoryId: 'cat_other', name: '蒸鱼（不辣）', priceType: 'per_serving', unitPrice: 0 },
    { categoryId: 'cat_other', name: '饭', priceType: 'per_serving', unitPrice: 3 }
  ],

  async initDefaultData() {
    // 首次初始化 — 新建用户
    const inited = await DB.getMeta('data_inited');
    if (!inited) {
      for (const cat of this.defaultCategories) {
        await DB.put('dishes', { ...cat, _type: 'category' });
      }
      for (const dish of this.defaultDishes) {
        await DB.put('dishes', {
          ...dish, id: this.genId(), available: true, _type: 'dish', createdAt: this.now(),
          flavors: dish.categoryId === 'cat_main' ? [...this.defaultMainFlavors] : []
        });
      }
      await DB.setMeta('data_inited', true);
      await DB.setMeta('menu_version', 3);
      return;
    }

    // 已有用户菜单迁移：version < 2 → 替换为备份数据
    const menuVer = await DB.getMeta('menu_version');
    if (!menuVer || menuVer < 2) {
      const all = await DB.getAll('dishes');
      for (const d of all) {
        await DB.delete('dishes', d.id);
      }
      for (const cat of this.defaultCategories) {
        await DB.put('dishes', { ...cat, _type: 'category' });
      }
      for (const dish of this.defaultDishes) {
        await DB.put('dishes', {
          ...dish, id: this.genId(), available: true, _type: 'dish', createdAt: this.now(),
          flavors: dish.categoryId === 'cat_main' ? [...this.defaultMainFlavors] : []
        });
      }
      await DB.setMeta('menu_version', 3);
    }

    // v3 迁移：给所有 cat_main 菜品补 flavors 字段
    if ((await DB.getMeta('menu_version')) < 3) {
      const all = await DB.getAll('dishes');
      for (const d of all) {
        if (d._type === 'dish' && d.categoryId === 'cat_main' && !Array.isArray(d.flavors)) {
          d.flavors = [...this.defaultMainFlavors];
          await DB.put('dishes', d);
        }
      }
      await DB.setMeta('menu_version', 3);
    }
  },

  async exportData() {
    const dishes = await DB.getAll('dishes');
    const orders = await DB.getAll('orders');
    const purchases = await DB.getAll('purchases');
    const purchaseCats = await DB.getMeta('purchaseCategories');
    const tableTags = await DB.getMeta('tableTags');
    const blob = new Blob(
      [JSON.stringify({ dishes, orders, purchases, purchaseCats, tableTags, exportedAt: this.now() }, null, 2)],
      { type: 'application/json' }
    );
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `点餐数据备份_${this.today()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  },

  // ---- 文本备份/恢复(跨设备简单同步) ----
  async exportToText() {
    const dishes = await DB.getAll('dishes');
    const orders = await DB.getAll('orders');
    const purchases = await DB.getAll('purchases');
    const purchaseCats = await DB.getMeta('purchaseCategories');
    const tableTags = await DB.getMeta('tableTags');
    return JSON.stringify({ dishes, orders, purchases, purchaseCats, tableTags, exportedAt: this.now() });
  },

  // ---- localStorage 双备份(IndexedDB 容易被浏览器清理,加一层冗余) ----
  // 容量限制约 5MB，订单数据通常远小于此
  LS_KEY: 'ordering_system_lsbackup',
  async saveLocalBackup() {
    try {
      const data = {
        dishes: await DB.getAll('dishes'),
        orders: await DB.getAll('orders'),
        purchases: await DB.getAll('purchases'),
        purchaseCats: await DB.getMeta('purchaseCategories'),
        tableTags: await DB.getMeta('tableTags'),
        savedAt: this.now()
      };
      localStorage.setItem(this.LS_KEY, JSON.stringify(data));
    } catch(e) {
      console.warn('localStorage 备份失败', e);
    }
  },
  getLocalBackup() {
    try {
      const raw = localStorage.getItem(this.LS_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch(e) { return null; }
  },

  statusLabel(status) {
    const map = { pending: '待处理', cooking: '制作中', done: '已完成', paid: '已付款' };
    return map[status] || status;
  },

  // ---- 销量统计：返回 dishId → {count, weight, revenue} ----
  computeDishSales(orders, sinceDate) {
    const sales = {};
    for (const o of orders) {
      if (o.deleted) continue;
      if (sinceDate && o.createdAt && o.createdAt.substring(0, 10) < sinceDate) continue;
      for (const item of (o.items || [])) {
        if (!sales[item.dishId]) sales[item.dishId] = { count: 0, weight: 0, revenue: 0 };
        sales[item.dishId].count += item.quantity || 0;
        sales[item.dishId].weight += item.weight || 0;
        sales[item.dishId].revenue += item.subtotal || 0;
      }
    }
    return sales;
  },

  // 实收金额：优先 actualPaid，否则 totalAmount
  effectiveAmount(order) {
    if (order.status === 'paid' && typeof order.actualPaid === 'number') return order.actualPaid;
    return order.totalAmount || 0;
  }
};
