// js/app.js — Vue 应用入口（所有页面逻辑合并在根组件）
const app = Vue.createApp({
  data() {
    return {
      // 导航
      page: 'queue',
      statusFilter: '',
      queueDate: '',
      // 时间刷新计数器（让 Vue 每分钟重算等待时长）
      tick: 0,

      // 共享数据
      orders: [],
      dishes: [],
      categories: [],
      purchases: [],
      purchaseCategories: [],
      tableTags: [],

      // === 菜单管理 ===
      menuSearch: '',
      menuActiveCat: null,        // null = 全部分类，'__hot__' = 热门
      showDishForm: false,
      showCatManager: false,
      editingDish: null,
      newCatName: '',
      form: {
        categoryId: 'cat_main', name: '', priceType: 'per_serving', unitPrice: 0,
        flavors: []
      },
      newFlavorInput: '',

      // === 桌号标签管理 ===
      showTableTagManager: false,
      newTableTagInput: '',

      // === 新建订单 ===
      orderActiveCat: null,
      orderTableNote: '',
      orderCart: [],
      addItemsToOrderId: null,

      // === 口味选择 ===
      showFlavorPicker: false,
      selectedFlavor: '',
      pendingFlavorDish: null,
      pendingWeight: 1,

      // === 收款弹框 ===
      showPayDialog: false,
      payOrderId: null,
      payActualAmount: 0,
      payNote: '',

      // === 打印小票 ===
      showPrintDialog: false,
      printOrderId: null,

      // === 安装提示 ===
      installPrompt: null,
      showInstallTip: false,

      // === 采购记录 ===
      purchaseDate: '',
      purchaseCateId: '',
      purchaseAmount: '',
      purchaseNote: '',
      purchaseFilterMonth: '',
      showPurchaseCatManager: false,
      newPurchaseCatName: '',

      // === 报表 ===
      reportDate: '',
      reportPeriod: 'day',
      reportMonth: '',
      reportYear: 2026,
      reportOrders: [],
      reportStats: { total: 0, paid: 0, done: 0, revenue: 0, active: 0 },
      showDeletedOrders: false,

      // === 利润 ===
      profitPeriod: 'day',
      profitDate: '',
      profitMonth: '',
      profitYear: 2026,
      profitStats: { revenue: 0, cost: 0, profit: 0, profitRate: 0, orderCount: 0 },
      profitDetails: [],

      // === 文本备份/恢复 ===
      showTextBackup: false,
      textBackupContent: '',
      textBackupMode: 'export', // export | import
    };
  },

  computed: {
    // ---- 订单队列 ----
    activeOrders() {
      return this.orders.filter(o => !o.deleted);
    },
    filteredOrders() {
      const day = this.queueDate
        ? this.activeOrders.filter(o => (o.createdAt || '').startsWith(this.queueDate))
        : this.activeOrders;
      if (!this.statusFilter) return day;
      return day.filter(o => o.status === this.statusFilter);
    },
    queueDayStats() {
      const day = this.queueDate
        ? this.activeOrders.filter(o => (o.createdAt || '').startsWith(this.queueDate))
        : this.activeOrders;
      const stats = { total: day.length, pending: 0, cooking: 0, done: 0, paid: 0, revenue: 0 };
      for (const o of day) {
        if (stats[o.status] !== undefined) stats[o.status]++;
        if (o.status === 'paid') stats.revenue += Utils.effectiveAmount(o);
      }
      stats.queueing = stats.pending + stats.cooking;
      stats.revenue = Math.round(stats.revenue * 100) / 100;
      return stats;
    },

    // 销量统计（最近30天）
    dishSales30d() {
      const since = Utils.shiftDate(Utils.today(), -30);
      return Utils.computeDishSales(this.activeOrders, since);
    },
    // 热门菜品（按销售额降序，至少有1次销售）
    hotDishes() {
      const sales = this.dishSales30d;
      return this.dishes
        .filter(d => sales[d.id])
        .map(d => ({ ...d, _sales: sales[d.id] }))
        .sort((a, b) => b._sales.revenue - a._sales.revenue)
        .slice(0, 20);
    },

    // ---- 菜单管理 ----
    menuFilteredCategories() {
      if (this.menuActiveCat === '__hot__') return [];
      return this.menuActiveCat
        ? this.categories.filter(c => c.id === this.menuActiveCat)
        : this.categories;
    },

    // ---- 新建订单 ----
    orderFilteredCategories() {
      return this.orderActiveCat
        ? this.categories.filter(c => c.id === this.orderActiveCat)
        : this.categories;
    },
    orderCartTotal() {
      return this.orderCart.reduce((sum, item) => sum + (item.subtotal || 0), 0);
    },

    // ---- 报表 ----
    weekRangeText() {
      if (!this.reportDate) return '';
      const range = this.getWeekRange(this.reportDate);
      return `第${range.weekNum}周 (${range.start.replace('-','/')} - ${range.end.replace('-','/')})`;
    },
    deletedOrdersOfPeriod() {
      const period = this.getReportPeriodRange();
      return this.orders.filter(o => {
        if (!o.deleted) return false;
        const d = (o.createdAt || '').substring(0, 10);
        return d >= period.start && d <= period.end;
      }).sort((a, b) => (a.createdAt || '') > (b.createdAt || '') ? -1 : 1);
    },

    // ---- 利润 ----
    profitWeekRangeText() {
      if (!this.profitDate) return '';
      const range = this.getWeekRange(this.profitDate);
      return `第${range.weekNum}周 (${range.start.replace('-','/')} - ${range.end.replace('-','/')})`;
    },

    // ---- 报表图表数据 ----
    last7DaysRevenue() {
      const result = [];
      for (let i = 6; i >= 0; i--) {
        const date = Utils.shiftDate(Utils.today(), -i);
        const dayOrders = this.activeOrders.filter(o =>
          o.status === 'paid' && (o.createdAt || '').startsWith(date)
        );
        const revenue = dayOrders.reduce((s, o) => s + Utils.effectiveAmount(o), 0);
        result.push({ date: date.slice(5), revenue: Math.round(revenue * 100) / 100 });
      }
      return result;
    },
    todayHourlyOrders() {
      const today = Utils.today();
      const buckets = Array(24).fill(0);
      for (const o of this.activeOrders) {
        if (!(o.createdAt || '').startsWith(today)) continue;
        const hour = parseInt((o.createdAt || '').substring(11, 13)) || 0;
        if (hour >= 0 && hour < 24) buckets[hour]++;
      }
      // 只显示 9:00-23:00
      return buckets.slice(9, 24).map((cnt, i) => ({ hour: i + 9, count: cnt }));
    },

    // ---- 采购 ----
    filteredPurchaseList() {
      if (!this.purchaseFilterMonth) return [];
      const prefix = this.purchaseFilterMonth;
      return this.purchases.filter(p => p.date && p.date.startsWith(prefix))
        .sort((a, b) => a.date > b.date ? -1 : (a.date < b.date ? 1 : 0));
    },
    purchaseMonthTotal() {
      return this.filteredPurchaseList.reduce((s, p) => s + (p.amount || 0), 0);
    },
    purchaseMonthCats() {
      const map = {};
      for (const p of this.filteredPurchaseList) {
        const name = this.purchaseCatName(p.categoryId);
        map[name] = (map[name] || 0) + (p.amount || 0);
      }
      return map;
    },
    purchaseCatName() {
      return (id) => {
        const c = this.purchaseCategories.find(c => c.id === id);
        return c ? c.name : id;
      };
    }
  },

  methods: {
    // ---- 通用 ----
    statusLabel(s) { return Utils.statusLabel(s); },
    getCatName(id) {
      const cat = this.categories.find(c => c.id === id);
      return cat ? cat.name : '';
    },
    effectiveAmount(o) { return Utils.effectiveAmount(o); },

    async exportData() { await Utils.exportData(); },

    // ---- 数据导入 ----
    importData() {
      const input = document.querySelector('input[type=file][accept=".json"]');
      if (input) input.click();
    },
    async onFileSelected(event) {
      const file = event.target.files[0];
      if (!file) return;
      try {
        const text = await file.text();
        await this.applyImportPayload(text);
      } catch(e) {
        alert('导入失败：文件格式错误或数据损坏\n' + e.message);
      }
      event.target.value = '';
    },
    async applyImportPayload(text) {
      const data = JSON.parse(text);
      if (!data.dishes || !data.orders) {
        alert('格式错误：备份数据缺少 dishes 或 orders 字段');
        return;
      }
      if (!confirm(`将导入 ${data.dishes.length} 条菜品/分类、${data.orders.length} 条订单、${data.purchases ? data.purchases.length : 0} 条采购记录，是否覆盖当前数据？`)) return;

      // 清空旧数据
      const oldDishes = await DB.getAll('dishes');
      for (const d of oldDishes) await DB.delete('dishes', d.id);
      const oldOrders = await DB.getAll('orders');
      for (const o of oldOrders) await DB.delete('orders', o.id);
      const oldPurchases = await DB.getAll('purchases');
      for (const p of oldPurchases) await DB.delete('purchases', p.id);

      for (const d of data.dishes) await DB.put('dishes', d);
      for (const o of data.orders) await DB.put('orders', o);
      if (data.purchases) for (const p of data.purchases) await DB.put('purchases', p);
      if (data.purchaseCats) await DB.setMeta('purchaseCategories', data.purchaseCats);
      if (data.tableTags) await DB.setMeta('tableTags', data.tableTags);

      await DB.setMeta('lastBackupDate', '');

      const purCount = data.purchases ? data.purchases.length : 0;
      alert(`✅ 导入成功！${data.dishes.length} 条菜品/分类，${data.orders.length} 条订单，${purCount} 条采购记录`);
      await this.reloadAll();
    },

    async reloadAll() {
      await this.loadDishes();
      await this.loadOrders();
      await this.loadPurchases();
      await this.loadPurchaseCategories();
      await this.loadTableTags();
      await this.loadReport();
      await Utils.saveLocalBackup();
    },

    // ---- 文本备份/恢复 ----
    async openTextExport() {
      this.textBackupMode = 'export';
      this.textBackupContent = await Utils.exportToText();
      this.showTextBackup = true;
    },
    openTextImport() {
      this.textBackupMode = 'import';
      this.textBackupContent = '';
      this.showTextBackup = true;
    },
    copyTextBackup() {
      if (!this.textBackupContent) return;
      // 优先用 Clipboard API,失败则降级
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(this.textBackupContent)
          .then(() => alert('✅ 已复制到剪贴板'))
          .catch(() => this.fallbackCopy());
      } else {
        this.fallbackCopy();
      }
    },
    fallbackCopy() {
      const ta = document.createElement('textarea');
      ta.value = this.textBackupContent;
      ta.style.position = 'fixed'; ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      try {
        document.execCommand('copy');
        alert('✅ 已复制到剪贴板');
      } catch(e) {
        alert('复制失败,请长按手动选中复制');
      }
      document.body.removeChild(ta);
    },
    async confirmTextImport() {
      if (!this.textBackupContent.trim()) {
        alert('请粘贴备份文本');
        return;
      }
      try {
        await this.applyImportPayload(this.textBackupContent.trim());
        this.showTextBackup = false;
      } catch(e) {
        alert('解析失败: ' + e.message);
      }
    },

    // ---- 安装提示 ----
    handleInstall() {
      if (!this.installPrompt) {
        this.showInstallTip = false;
        return;
      }
      this.installPrompt.prompt();
      this.installPrompt.userChoice.then(() => {
        this.installPrompt = null;
        this.showInstallTip = false;
        localStorage.setItem('install_dismissed', '1');
      });
    },
    dismissInstallTip() {
      this.showInstallTip = false;
      localStorage.setItem('install_dismissed', '1');
    },

    // ---- 订单队列 ----
    nextBtnLabel(status) {
      const map = { pending: '做菜', cooking: '上菜', done: '收款' };
      return map[status] || '';
    },
    shiftQueueDate(delta) {
      if (delta === 0) { this.queueDate = Utils.today(); return; }
      this.queueDate = Utils.shiftDate(this.queueDate || Utils.today(), delta);
    },
    queueDateLabel() {
      if (!this.queueDate) return '';
      const today = Utils.today();
      if (this.queueDate === today) return '今天';
      if (this.queueDate === Utils.shiftDate(today, -1)) return '昨天';
      return this.queueDate;
    },
    isQueueToday() {
      return this.queueDate === Utils.today();
    },

    // 订单等待时长(分钟)
    waitMinutes(order) {
      this.tick; // 触发响应式
      if (order.status === 'paid' || order.status === 'done') return 0;
      return Utils.minutesSince(order.createdAt);
    },
    waitLabel(order) {
      const m = this.waitMinutes(order);
      if (m <= 0) return '';
      if (m < 60) return `等待 ${m} 分钟`;
      const h = Math.floor(m / 60);
      const r = m % 60;
      return `等待 ${h}h${r}m`;
    },

    async advanceOrder(id) {
      try {
        const order = this.activeOrders.find(o => o.id === id);
        if (!order) { alert('订单不存在'); return; }
        // 收款步骤改为弹框确认
        if (order.status === 'done') {
          this.openPayDialog(order);
          return;
        }
        const flow = { pending: 'cooking', cooking: 'done' };
        const nextStatus = flow[order.status];
        if (!nextStatus) return;
        order.status = nextStatus;
        order.updatedAt = Utils.now();
        await DB.put('orders', order);
        await Utils.saveLocalBackup();
      } catch(e) { alert('操作失败: ' + e.message); }
      await this.loadOrders();
    },

    // ---- 收款弹框 ----
    openPayDialog(order) {
      this.payOrderId = order.id;
      this.payActualAmount = order.totalAmount;
      this.payNote = '';
      this.showPayDialog = true;
    },
    quickRoundDown(unit) {
      // unit=10 抹到整十,unit=1 抹零头
      const amt = parseFloat(this.payActualAmount) || 0;
      this.payActualAmount = Math.floor(amt / unit) * unit;
    },
    setDiscount(rate) {
      const order = this.activeOrders.find(o => o.id === this.payOrderId);
      if (!order) return;
      this.payActualAmount = Math.round(order.totalAmount * rate * 100) / 100;
    },
    async confirmPay() {
      try {
        const order = this.activeOrders.find(o => o.id === this.payOrderId);
        if (!order) { alert('订单不存在'); return; }
        const actual = parseFloat(this.payActualAmount);
        if (isNaN(actual) || actual < 0) { alert('请输入有效实收金额'); return; }
        order.status = 'paid';
        order.actualPaid = Math.round(actual * 100) / 100;
        order.paymentNote = this.payNote.trim();
        order.paidAt = Utils.now();
        order.updatedAt = Utils.now();
        await DB.put('orders', order);
        await Utils.saveLocalBackup();
      } catch(e) { alert('操作失败: ' + e.message); }
      this.showPayDialog = false;
      this.payOrderId = null;
      await this.loadOrders();
    },
    cancelPay() {
      this.showPayDialog = false;
      this.payOrderId = null;
    },

    // ---- 软删除 ----
    async deleteOrder(id) {
      const order = this.orders.find(o => o.id === id);
      if (!order) return;
      let reason = '';
      if (order.status === 'paid') {
        reason = prompt('已付款订单,请输入删除原因(必填):');
        if (!reason || !reason.trim()) {
          alert('已取消');
          return;
        }
      } else {
        if (!confirm('确定删除此订单?可在报表「已删除」中恢复。')) return;
      }
      order.deleted = true;
      order.deletedAt = Utils.now();
      order.deleteReason = (reason || '').trim();
      await DB.put('orders', order);
      await Utils.saveLocalBackup();
      await this.loadOrders();
    },
    async restoreOrder(id) {
      const order = this.orders.find(o => o.id === id);
      if (!order) return;
      if (!confirm('恢复此订单?')) return;
      delete order.deleted;
      delete order.deletedAt;
      delete order.deleteReason;
      await DB.put('orders', order);
      await Utils.saveLocalBackup();
      await this.loadOrders();
    },
    async permanentlyDeleteOrder(id) {
      if (!confirm('永久删除此订单?此操作不可撤销!')) return;
      await DB.delete('orders', id);
      await Utils.saveLocalBackup();
      await this.loadOrders();
    },
    // 启动时清理超过30天的已删除订单
    async cleanupOldDeletedOrders() {
      const cutoff = Utils.shiftDate(Utils.today(), -30);
      let cleaned = 0;
      for (const o of this.orders) {
        if (o.deleted && o.deletedAt && o.deletedAt.substring(0, 10) < cutoff) {
          await DB.delete('orders', o.id);
          cleaned++;
        }
      }
      if (cleaned > 0) await this.loadOrders();
    },

    async loadOrders() {
      this.orders = await DB.getAll('orders');
      this.orders.sort((a, b) => (b.createdAt || '') > (a.createdAt || '') ? 1 : -1);
    },
    async loadDishes() {
      const all = await DB.getAll('dishes');
      this.categories = all.filter(d => d._type === 'category').sort((a, b) => a.sortOrder - b.sortOrder);
      this.dishes = all.filter(d => d._type === 'dish');
    },

    // ---- 菜单管理 ----
    openAddDish() {
      this.editingDish = null;
      const catId = (this.menuActiveCat && this.menuActiveCat !== '__hot__') ? this.menuActiveCat : 'cat_main';
      this.form = {
        categoryId: catId, name: '', priceType: 'per_serving', unitPrice: 0,
        flavors: catId === 'cat_main' ? [...Utils.defaultMainFlavors] : []
      };
      this.newFlavorInput = '';
      this.showDishForm = true;
    },
    openEditDish(dish) {
      this.editingDish = dish;
      this.form = {
        categoryId: dish.categoryId,
        name: dish.name,
        priceType: dish.priceType,
        unitPrice: dish.unitPrice,
        flavors: Array.isArray(dish.flavors) ? [...dish.flavors] : []
      };
      this.newFlavorInput = '';
      this.showDishForm = true;
    },
    closeDishForm() {
      this.showDishForm = false;
      this.editingDish = null;
    },
    addFlavor() {
      const f = this.newFlavorInput.trim();
      if (!f) return;
      if (!this.form.flavors.includes(f)) this.form.flavors.push(f);
      this.newFlavorInput = '';
    },
    removeFlavor(idx) {
      this.form.flavors.splice(idx, 1);
    },
    getCatDishes(catId) {
      let list = this.dishes.filter(d => d.categoryId === catId)
        .sort((a, b) => (a.createdAt || '') > (b.createdAt || '') ? -1 : 1);
      if (this.menuSearch.trim()) {
        const term = this.menuSearch.trim().toLowerCase();
        list = list.filter(d => d.name.toLowerCase().includes(term));
      }
      return list;
    },
    dishSalesLabel(dishId) {
      const s = this.dishSales30d[dishId];
      if (!s) return '';
      const num = s.count + s.weight;
      if (num <= 0) return '';
      // 按斤的菜品显示斤数,按份显示份数
      const dish = this.dishes.find(d => d.id === dishId);
      if (dish && dish.priceType === 'per_jin') return `30天 ${s.weight.toFixed(1)}斤`;
      return `30天 ${s.count}份`;
    },
    canDeleteCat(catId) {
      return !['cat_main', 'cat_side', 'cat_fry', 'cat_drink', 'cat_other'].includes(catId);
    },
    async toggleDish(dish) {
      dish.available = !dish.available;
      await DB.put('dishes', dish);
      await this.loadDishes();
    },
    async deleteDish(id) {
      if (!confirm('确定删除此菜品？')) return;
      await DB.delete('dishes', id);
      await this.loadDishes();
    },
    async saveDish() {
      if (!this.form.name.trim()) { alert('请输入菜名'); return; }
      if (this.form.unitPrice === '' || this.form.unitPrice === null || isNaN(this.form.unitPrice)) { alert('请输入有效价格'); return; }
      const dish = this.editingDish ? { ...this.editingDish } : {
        id: Utils.genId(), _type: 'dish', available: true, createdAt: Utils.now()
      };
      dish.categoryId = this.form.categoryId;
      dish.name = this.form.name.trim();
      dish.priceType = this.form.priceType;
      dish.unitPrice = Number(this.form.unitPrice);
      // 非主菜不保存口味
      dish.flavors = this.form.categoryId === 'cat_main' ? [...this.form.flavors] : [];
      await DB.put('dishes', dish);
      await Utils.saveLocalBackup();
      this.closeDishForm();
      await this.loadDishes();
    },
    async addCat() {
      if (!this.newCatName.trim()) { alert('请输入分类名称'); return; }
      await DB.put('dishes', {
        id: 'cat_' + Utils.genId(), _type: 'category',
        name: this.newCatName.trim(), sortOrder: this.categories.length + 1
      });
      this.newCatName = '';
      await this.loadDishes();
    },
    async renameCat(id, name) {
      if (!name.trim()) return;
      const cat = this.categories.find(c => c.id === id);
      if (cat && cat.name !== name.trim()) {
        cat.name = name.trim();
        await DB.put('dishes', cat);
        await this.loadDishes();
      }
    },
    async deleteCat(id) {
      if (!confirm('删除分类后，该分类下的菜品也会一并删除，确定？')) return;
      for (const d of this.getCatDishes(id)) await DB.delete('dishes', d.id);
      await DB.delete('dishes', id);
      await this.loadDishes();
    },

    // ---- 桌号标签管理 ----
    async loadTableTags() {
      this.tableTags = await Utils.initTableTags();
    },
    quickPickTableTag(tag) {
      this.orderTableNote = tag;
    },
    async addTableTag() {
      const t = this.newTableTagInput.trim();
      if (!t) return;
      if (this.tableTags.includes(t)) { alert('已存在'); return; }
      this.tableTags.push(t);
      await Utils.saveTableTags(this.tableTags);
      this.newTableTagInput = '';
    },
    async deleteTableTag(idx) {
      this.tableTags.splice(idx, 1);
      await Utils.saveTableTags(this.tableTags);
    },

    // ---- 新建订单 ----
    getAvailDishes(catId) {
      return this.dishes.filter(d => d.categoryId === catId && d.available !== false);
    },
    addToCart(dish) {
      // 仅主菜分类需要口味选择,其他分类一律直接加购
      const needFlavor = dish.categoryId === 'cat_main';
      if (needFlavor) {
        this.pendingFlavorDish = dish;
        this.selectedFlavor = '';
        this.pendingWeight = 1;
        this.showFlavorPicker = true;
        return;
      }
      const existing = this.orderCart.find(item => item.dishId === dish.id && !item.flavor);
      if (existing) {
        if (existing.priceType === 'per_jin') {
          existing.weight = (existing.weight || 0) + 1;
        } else {
          existing.quantity = (existing.quantity || 0) + 1;
        }
        this.recalcItem(existing);
      } else {
        this.orderCart.push({
          dishId: dish.id, name: dish.name, categoryId: dish.categoryId,
          priceType: dish.priceType, unitPrice: dish.unitPrice,
          quantity: dish.priceType === 'per_jin' ? 0 : 1,
          weight: dish.priceType === 'per_jin' ? 1 : 0,
          subtotal: dish.unitPrice,
          flavor: ''
        });
      }
    },
    recalcItem(item) {
      if (item.priceType === 'per_jin') {
        item.subtotal = (item.unitPrice || 0) * (parseFloat(item.weight) || 0);
      } else {
        item.subtotal = (item.unitPrice || 0) * (item.quantity || 0);
      }
    },
    changeQty(item, delta) {
      item.quantity = Math.max(1, (item.quantity || 1) + delta);
      this.recalcItem(item);
    },
    removeItem(idx) {
      this.orderCart.splice(idx, 1);
    },

    // ---- 口味选择 ----
    pendingFlavorOptions() {
      const dish = this.pendingFlavorDish;
      if (!dish) return [];
      if (Array.isArray(dish.flavors) && dish.flavors.length > 0) return dish.flavors;
      // 兼容旧主菜
      return Utils.defaultMainFlavors;
    },
    confirmFlavor() {
      const dish = this.pendingFlavorDish;
      if (!dish) return;
      if (dish.priceType === 'per_jin' && (!this.pendingWeight || this.pendingWeight <= 0)) {
        alert('请输入有效斤数'); return;
      }
      const weight = this.pendingWeight || 1;
      const sameItem = this.orderCart.find(
        item => item.dishId === dish.id && item.flavor === (this.selectedFlavor || '')
      );
      if (sameItem) {
        if (sameItem.priceType === 'per_jin') {
          sameItem.weight = (sameItem.weight || 0) + weight;
        } else {
          sameItem.quantity = (sameItem.quantity || 0) + weight;
        }
        this.recalcItem(sameItem);
      } else {
        this.orderCart.push({
          dishId: dish.id, name: dish.name, categoryId: dish.categoryId,
          priceType: dish.priceType, unitPrice: dish.unitPrice,
          quantity: dish.priceType === 'per_jin' ? 0 : weight,
          weight: dish.priceType === 'per_jin' ? weight : 0,
          subtotal: dish.unitPrice * weight,
          flavor: this.selectedFlavor || ''
        });
      }
      this.showFlavorPicker = false;
      this.pendingFlavorDish = null;
      this.pendingWeight = 1;
    },
    cancelFlavor() {
      this.showFlavorPicker = false;
      this.pendingFlavorDish = null;
    },

    // ---- 中途加菜 ----
    startAddItems(order) {
      this.addItemsToOrderId = order.id;
      this.orderTableNote = order.tableNote;
      this.orderCart = [];
      this.orderActiveCat = null;
      this.page = 'order';
    },
    getAddingOrderNum() {
      const order = this.activeOrders.find(o => o.id === this.addItemsToOrderId);
      return order ? order.orderNumber : 0;
    },
    cancelOrder() {
      this.addItemsToOrderId = null;
      this.orderCart = [];
      this.orderTableNote = '';
      this.page = 'queue';
    },

    async submitOrder() {
      try {
        if (this.orderCart.length === 0) { alert('请至少选择一道菜品'); return; }
        for (const item of this.orderCart) {
          if (item.priceType === 'per_jin' && (!item.weight || item.weight <= 0)) {
            alert('请填写「' + item.name + '」的斤数'); return;
          }
        }
        const items = this.orderCart.map(item => ({
          dishId: item.dishId, name: item.name, categoryId: item.categoryId,
          priceType: item.priceType, unitPrice: item.unitPrice,
          quantity: item.priceType === 'per_jin' ? 0 : (item.quantity || 1),
          weight: item.priceType === 'per_jin' ? parseFloat(item.weight) || 0 : 0,
          subtotal: Math.round(item.subtotal * 100) / 100,
          flavor: item.flavor || ''
        }));

        if (this.addItemsToOrderId) {
          const order = this.activeOrders.find(o => o.id === this.addItemsToOrderId);
          if (!order) { alert('订单不存在'); return; }
          for (const newItem of items) {
            const same = order.items.find(
              i => i.dishId === newItem.dishId && (i.flavor || '') === (newItem.flavor || '')
            );
            if (same) {
              if (same.priceType === 'per_jin') {
                same.weight = (same.weight || 0) + (newItem.weight || 0);
                same.subtotal = same.unitPrice * same.weight;
              } else {
                same.quantity = (same.quantity || 0) + (newItem.quantity || 0);
                same.subtotal = same.unitPrice * same.quantity;
              }
            } else {
              order.items.push(newItem);
            }
          }
          order.totalAmount = Math.round(order.items.reduce((sum, i) => sum + i.subtotal, 0) * 100) / 100;
          order._addItems = true;
          order.updatedAt = Utils.now();
          await DB.put('orders', order);
        } else {
          const totalAmount = Math.round(items.reduce((sum, item) => sum + item.subtotal, 0) * 100) / 100;
          const maxNum = await DB.getMaxOrderNumber(Utils.today());
          await DB.put('orders', {
            id: Utils.genId(),
            orderNumber: maxNum + 1,
            tableNote: this.orderTableNote.trim(),
            items, totalAmount,
            status: 'pending',
            createdAt: Utils.now(),
            paidAt: null
          });
        }
        await Utils.saveLocalBackup();
      } catch(e) { alert('提交失败: ' + e.message); }

      this.addItemsToOrderId = null;
      this.orderCart = [];
      this.orderTableNote = '';
      this.queueDate = Utils.today();
      this.page = 'queue';
      await this.loadOrders();
    },

    // ---- 打印小票 ----
    openPrintDialog(order) {
      this.printOrderId = order.id;
      this.showPrintDialog = true;
    },
    getPrintOrder() {
      return this.activeOrders.find(o => o.id === this.printOrderId);
    },
    doPrint() {
      window.print();
    },

    // ---- 采购类加载 ----
    async loadPurchaseCategories() {
      this.purchaseCategories = await Utils.initPurchaseCategories();
    },
    async openAddPurchaseCat() {
      this.newPurchaseCatName = '';
      this.showPurchaseCatManager = true;
    },
    async addPurchaseCat() {
      if (!this.newPurchaseCatName.trim()) { alert('请输入分类名称'); return; }
      const maxOrder = this.purchaseCategories.reduce((m, c) => Math.max(m, c.sortOrder || 0), 0);
      this.purchaseCategories.push({
        id: 'pc_' + Utils.genId(),
        name: this.newPurchaseCatName.trim(),
        sortOrder: maxOrder + 1
      });
      await Utils.savePurchaseCategories(this.purchaseCategories);
      this.newPurchaseCatName = '';
    },
    async renamePurchaseCat(id, name) {
      if (!name.trim()) return;
      const cat = this.purchaseCategories.find(c => c.id === id);
      if (cat && cat.name !== name.trim()) {
        cat.name = name.trim();
        await Utils.savePurchaseCategories(this.purchaseCategories);
      }
    },
    async deletePurchaseCat(id) {
      if (!confirm('确定删除此采购分类？已使用该分类的采购记录不受影响。')) return;
      this.purchaseCategories = this.purchaseCategories.filter(c => c.id !== id);
      await Utils.savePurchaseCategories(this.purchaseCategories);
    },

    // ---- 采购记录 ----
    async loadPurchases() {
      this.purchases = await DB.getAll('purchases');
      this.purchases.sort((a, b) => (a.date || '') > (b.date || '') ? -1 : 1);
    },
    async addPurchase() {
      if (!this.purchaseCateId) { alert('请选择采购分类'); return; }
      const amount = parseFloat(this.purchaseAmount);
      if (isNaN(amount) || amount <= 0) { alert('请输入有效金额'); return; }
      await DB.put('purchases', {
        id: Utils.genId(),
        date: this.purchaseDate || Utils.today(),
        categoryId: this.purchaseCateId,
        amount: Math.round(amount * 100) / 100,
        note: this.purchaseNote.trim(),
        createdAt: Utils.now()
      });
      await Utils.saveLocalBackup();
      this.purchaseCateId = '';
      this.purchaseAmount = '';
      this.purchaseNote = '';
      await this.loadPurchases();
    },
    async deletePurchase(id) {
      if (!confirm('确定删除此采购记录？')) return;
      await DB.delete('purchases', id);
      await Utils.saveLocalBackup();
      await this.loadPurchases();
    },

    // ---- 利润分析 ----
    switchProfitPeriod(period) {
      this.profitPeriod = period;
      if (period === 'month') this.profitMonth = Utils.today().substring(0, 7);
      if (period === 'year') this.profitYear = parseInt(Utils.today().substring(0, 4));
      this.loadProfit();
    },
    loadProfit() {
      const allOrders = this.activeOrders;
      const allPurchases = this.purchases;

      let startDate = '', endDate = '';
      if (this.profitPeriod === 'day') {
        startDate = this.profitDate; endDate = this.profitDate;
      } else if (this.profitPeriod === 'week') {
        const range = this.getWeekRange(this.profitDate);
        startDate = range.start; endDate = range.end;
      } else if (this.profitPeriod === 'month') {
        startDate = this.profitMonth + '-01';
        const y = parseInt(this.profitMonth.substring(0, 4));
        const m = parseInt(this.profitMonth.substring(5, 7));
        const lastDay = new Date(y, m, 0).getDate();
        endDate = this.profitMonth + '-' + String(lastDay).padStart(2, '0');
      } else if (this.profitPeriod === 'year') {
        startDate = this.profitYear + '-01-01';
        endDate = this.profitYear + '-12-31';
      }

      const periodOrders = allOrders.filter(o => {
        if (!o.createdAt || o.status !== 'paid') return false;
        const d = o.createdAt.substring(0, 10);
        return d >= startDate && d <= endDate;
      });
      const revenue = periodOrders.reduce((sum, o) => sum + Utils.effectiveAmount(o), 0);

      const periodPurchases = allPurchases.filter(p => p.date >= startDate && p.date <= endDate);
      const cost = periodPurchases.reduce((sum, p) => sum + (p.amount || 0), 0);
      const profit = Math.round((revenue - cost) * 100) / 100;
      const profitRate = revenue > 0 ? Math.round(profit / revenue * 10000) / 100 : 0;

      this.profitStats = {
        revenue: Math.round(revenue * 100) / 100,
        cost: Math.round(cost * 100) / 100,
        profit, profitRate,
        orderCount: periodOrders.length
      };

      const dayMap = {};
      for (const o of periodOrders) {
        const d = o.createdAt.substring(0, 10);
        if (!dayMap[d]) dayMap[d] = { revenue: 0, cost: 0 };
        dayMap[d].revenue += Utils.effectiveAmount(o);
      }
      for (const p of periodPurchases) {
        if (!dayMap[p.date]) dayMap[p.date] = { revenue: 0, cost: 0 };
        dayMap[p.date].cost += p.amount || 0;
      }
      this.profitDetails = Object.entries(dayMap)
        .map(([date, v]) => ({
          date,
          revenue: Math.round(v.revenue * 100) / 100,
          cost: Math.round(v.cost * 100) / 100,
          profit: Math.round((v.revenue - v.cost) * 100) / 100
        }))
        .sort((a, b) => a.date > b.date ? -1 : 1);
    },

    getWeekRange(dateStr) {
      const d = new Date(dateStr);
      const day = d.getDay();
      const diff = day === 0 ? -6 : 1 - day;
      const mon = new Date(d);
      mon.setDate(d.getDate() + diff);
      const sun = new Date(mon);
      sun.setDate(mon.getDate() + 6);
      const fmt = (dt) => {
        const m = String(dt.getMonth() + 1).padStart(2, '0');
        const dd = String(dt.getDate()).padStart(2, '0');
        return `${dt.getFullYear()}-${m}-${dd}`;
      };
      const weekNum = Math.ceil(((mon - new Date(mon.getFullYear(), 0, 1)) / 86400000 + 1) / 7);
      return { start: fmt(mon), end: fmt(sun), weekNum };
    },

    getReportPeriodRange() {
      if (this.reportPeriod === 'day') return { start: this.reportDate, end: this.reportDate };
      if (this.reportPeriod === 'week') return this.getWeekRange(this.reportDate);
      if (this.reportPeriod === 'month') {
        const y = parseInt(this.reportMonth.substring(0, 4));
        const m = parseInt(this.reportMonth.substring(5, 7));
        const lastDay = new Date(y, m, 0).getDate();
        return { start: this.reportMonth + '-01', end: this.reportMonth + '-' + String(lastDay).padStart(2, '0') };
      }
      if (this.reportPeriod === 'year') {
        return { start: this.reportYear + '-01-01', end: this.reportYear + '-12-31' };
      }
      return { start: '', end: '' };
    },

    switchPeriod(period) {
      this.reportPeriod = period;
      this.loadReport();
    },

    async loadReport() {
      const all = this.orders;
      const range = this.getReportPeriodRange();
      const inRange = (createdAt) => {
        if (!createdAt) return false;
        const d = createdAt.substring(0, 10);
        return d >= range.start && d <= range.end;
      };
      const filtered = all.filter(o => !o.deleted && inRange(o.createdAt));
      this.reportOrders = filtered.sort((a, b) => ((a.createdAt || '') > (b.createdAt || '') ? -1 : 1));
      const paidOrders = this.reportOrders.filter(o => o.status === 'paid');
      const doneOrders = this.reportOrders.filter(o => o.status === 'done');
      const activeOrders = all.filter(o => !o.deleted && (o.status === 'pending' || o.status === 'cooking'));
      this.reportStats = {
        total: this.reportOrders.length,
        paid: paidOrders.length,
        done: doneOrders.length + paidOrders.length,
        active: activeOrders.length,
        revenue: paidOrders.reduce((sum, o) => sum + Utils.effectiveAmount(o), 0)
      };
    },

    // ---- 报表图表(纯 SVG) ----
    // viewBox: 320x130, 顶部预留 18 给金额标签,底部预留 18 给日期标签,左右各 18 防溢出
    revenueChartPath() {
      const data = this.last7DaysRevenue;
      if (!data.length) return '';
      const w = 320, padX = 22, top = 18, bottom = 112; // 折线纵向区间 [top, bottom]
      const max = Math.max(1, ...data.map(d => d.revenue));
      const stepX = (w - 2 * padX) / (data.length - 1 || 1);
      return data.map((d, i) => {
        const x = padX + i * stepX;
        const y = bottom - ((d.revenue / max) * (bottom - top));
        return (i === 0 ? 'M' : 'L') + x.toFixed(1) + ',' + y.toFixed(1);
      }).join(' ');
    },
    revenueChartPoints() {
      const data = this.last7DaysRevenue;
      if (!data.length) return [];
      const w = 320, padX = 22, top = 18, bottom = 112;
      const max = Math.max(1, ...data.map(d => d.revenue));
      const stepX = (w - 2 * padX) / (data.length - 1 || 1);
      return data.map((d, i) => ({
        x: padX + i * stepX,
        y: bottom - ((d.revenue / max) * (bottom - top)),
        revenue: d.revenue,
        date: d.date
      }));
    }
  },

  async mounted() {
    this.queueDate = Utils.today();
    this.reportDate = Utils.today();
    this.reportMonth = Utils.today().substring(0, 7);
    this.reportYear = parseInt(Utils.today().substring(0, 4));
    this.purchaseDate = Utils.today();
    this.purchaseFilterMonth = Utils.today().substring(0, 7);
    this.profitPeriod = 'month';
    this.profitDate = Utils.today();
    this.profitMonth = Utils.today().substring(0, 7);
    this.profitYear = parseInt(Utils.today().substring(0, 4));
    await DB.open();

    // 启动恢复检测：IndexedDB 空但 localStorage 有备份 → 提示恢复
    try {
      const orderCount = (await DB.getAll('orders')).length;
      const dishCount = (await DB.getAll('dishes')).length;
      const lsBackup = Utils.getLocalBackup();
      if (orderCount === 0 && dishCount === 0 && lsBackup &&
          (lsBackup.orders?.length > 0 || lsBackup.dishes?.length > 0)) {
        if (confirm(`⚠️ 检测到本地有备份(${lsBackup.savedAt})，包含${lsBackup.orders?.length || 0}单+${lsBackup.dishes?.length || 0}菜品/分类。当前数据库为空，是否恢复？`)) {
          for (const d of (lsBackup.dishes || [])) await DB.put('dishes', d);
          for (const o of (lsBackup.orders || [])) await DB.put('orders', o);
          for (const p of (lsBackup.purchases || [])) await DB.put('purchases', p);
          if (lsBackup.purchaseCats) await DB.setMeta('purchaseCategories', lsBackup.purchaseCats);
          if (lsBackup.tableTags) await DB.setMeta('tableTags', lsBackup.tableTags);
          alert('✅ 已从本地备份恢复');
        }
      }
    } catch(e) { /* 静默 */ }

    // 每日自动备份
    const lastBackup = await DB.getMeta('lastBackupDate');
    if (lastBackup !== Utils.today()) {
      try {
        await Utils.exportData();
        await DB.setMeta('lastBackupDate', Utils.today());
      } catch(e) { /* 静默 */ }
    }

    await Utils.initDefaultData();
    await this.loadDishes();
    await this.loadOrders();
    await this.loadPurchaseCategories();
    await this.loadPurchases();
    await this.loadTableTags();
    await this.loadReport();
    await this.cleanupOldDeletedOrders();
    await Utils.saveLocalBackup();

    // 每分钟刷新等待时长
    setInterval(() => { this.tick++; }, 60000);

    // PWA 安装提示
    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      this.installPrompt = e;
      if (!localStorage.getItem('install_dismissed')) {
        this.showInstallTip = true;
      }
    });

    this.$watch('page', async (newVal) => {
      if (newVal === 'queue') { await this.loadOrders(); }
      if (newVal === 'report') { await this.loadReport(); }
      if (newVal === 'purchase') {
        this.purchaseFilterMonth = Utils.today().substring(0, 7);
      }
      if (newVal === 'profit') { this.profitPeriod = 'month'; this.loadProfit(); }
      if (newVal === 'order' && !this.addItemsToOrderId) {
        this.orderCart = [];
        this.orderTableNote = '';
      }
    });
  }
});

app.mount('#app');
