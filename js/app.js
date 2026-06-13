// js/app.js — Vue 应用入口（所有页面逻辑合并在根组件）
const app = Vue.createApp({
  data() {
    return {
      // 导航
      page: 'queue',
      statusFilter: '',
      queueDate: '', // 订单队列当前查看日期，默认今日

      // 共享数据
      orders: [],
      dishes: [],
      categories: [],
      purchases: [],
      purchaseCategories: [],

      // === 菜单管理 ===
      menuSearch: '',
      menuActiveCat: null,
      showDishForm: false,
      showCatManager: false,
      editingDish: null,
      newCatName: '',
      form: { categoryId: 'cat_main', name: '', priceType: 'per_serving', unitPrice: 0 },

      // === 新建订w单 ===
      orderActiveCat: null,
      orderTableNote: '',
      orderCart: [],
      addItemsToOrderId: null,  // 非null表示给已有订单加菜

      // === 口味选择 ===
      showFlavorPicker: false,
      selectedFlavor: '',
      pendingFlavorDish: null,
      pendingWeight: 1,
      flavorOptions: [
        { value: '酸汤', label: '酸汤' },
        { value: '青椒', label: '青椒' },
        { value: '清汤', label: '清汤' },
        { value: '鸳鸯(酸汤+青椒)', label: '鸳鸯(酸汤+青椒)' },
        { value: '鸳鸯(酸汤+清汤)', label: '鸳鸯(酸汤+清汤)' },
        { value: '鸳鸯(青椒+清汤)', label: '鸳鸯(青椒+清汤)' },
      ],

      // === 采购记录 ===
      purchaseDate: '',
      purchaseCateId: '',
      purchaseAmount: '',
      purchaseNote: '',
      purchaseFilterMonth: '',

      // === 采购分类管理 ===
      showPurchaseCatManager: false,
      newPurchaseCatName: '',

      // === 每日报表 ===
      reportDate: '',
      reportPeriod: 'day',
      reportMonth: '',
      reportYear: 2026,
      reportWeek: '',
      reportOrders: [],
      reportStats: { total: 0, paid: 0, done: 0, revenue: 0 },

      // === 利润分析 ===
      profitPeriod: 'day',
      profitDate: '',
      profitMonth: '',
      profitYear: 2026,
      profitStats: { revenue: 0, cost: 0, profit: 0, profitRate: 0, orderCount: 0 },
      profitDetails: []
    };
  },

  computed: {
    // ---- 订单队列 ----
    filteredOrders() {
      // 先按日期过滤
      const dayOrders = this.queueDate
        ? this.orders.filter(o => (o.createdAt || '').startsWith(this.queueDate))
        : this.orders;
      if (!this.statusFilter) return dayOrders;
      return dayOrders.filter(o => o.status === this.statusFilter);
    },

    // 当日订单按状态分组的数量统计
    queueDayStats() {
      const dayOrders = this.queueDate
        ? this.orders.filter(o => (o.createdAt || '').startsWith(this.queueDate))
        : this.orders;
      const stats = { total: dayOrders.length, pending: 0, cooking: 0, done: 0, paid: 0, revenue: 0 };
      for (const o of dayOrders) {
        if (stats[o.status] !== undefined) stats[o.status]++;
        if (o.status === 'paid') stats.revenue += o.totalAmount || 0;
      }
      stats.queueing = stats.pending + stats.cooking; // 排队中=待处理+制作中
      stats.revenue = Math.round(stats.revenue * 100) / 100;
      return stats;
    },

    // ---- 菜单管理 ----
    menuFilteredCategories() {
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

    // ---- 利润 ----
    profitWeekRangeText() {
      if (!this.profitDate) return '';
      const range = this.getWeekRange(this.profitDate);
      return `第${range.weekNum}周 (${range.start.replace('-','/')} - ${range.end.replace('-','/')})`;
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

    async exportData() { await Utils.exportData(); },

    // ---- 数据导入 ----
    importData() {
      // 触发文件选择
      const input = document.querySelector('input[type=file][accept=".json"]');
      if (input) input.click();
    },
    async onFileSelected(event) {
      const file = event.target.files[0];
      if (!file) return;
      try {
        const text = await file.text();
        const data = JSON.parse(text);
        if (!data.dishes || !data.orders) {
          alert('格式错误：备份文件缺少 dishes 或 orders 数据');
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

        // 写入新数据
        for (const d of data.dishes) await DB.put('dishes', d);
        for (const o of data.orders) await DB.put('orders', o);
        if (data.purchases) {
          for (const p of data.purchases) await DB.put('purchases', p);
        }
        if (data.purchaseCats) {
          await DB.setMeta('purchaseCategories', data.purchaseCats);
        }

        // 重置备份标记，下次自动备份
        await DB.setMeta('lastBackupDate', '');

        const purCount = data.purchases ? data.purchases.length : 0;
        alert(`✅ 导入成功！${data.dishes.length} 条菜品/分类，${data.orders.length} 条订单，${purCount} 条采购记录`);
        await this.loadDishes();
        await this.loadOrders();
        await this.loadPurchases();
        await this.loadPurchaseCategories();
        await this.loadReport();
      } catch(e) {
        alert('导入失败：文件格式错误或数据损坏\n' + e.message);
      }
      event.target.value = '';
    },

    // ---- 订单队列 ----
    nextBtnLabel(status) {
      const map = { pending: '做菜', cooking: '上菜', done: '收款' };
      return map[status] || '';
    },
    // 切换队列查看日期(delta:-1=前一天, 1=后一天, 0=今日)
    shiftQueueDate(delta) {
      if (delta === 0) {
        this.queueDate = Utils.today();
        return;
      }
      const d = new Date(this.queueDate || Utils.today());
      d.setDate(d.getDate() + delta);
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const dd = String(d.getDate()).padStart(2, '0');
      this.queueDate = `${d.getFullYear()}-${m}-${dd}`;
    },
    // 当日队列日期显示(今天/昨天/具体日期)
    queueDateLabel() {
      if (!this.queueDate) return '';
      const today = Utils.today();
      if (this.queueDate === today) return '今天';
      const t = new Date(today);
      t.setDate(t.getDate() - 1);
      const yMm = String(t.getMonth() + 1).padStart(2, '0');
      const yDd = String(t.getDate()).padStart(2, '0');
      const yesterday = `${t.getFullYear()}-${yMm}-${yDd}`;
      if (this.queueDate === yesterday) return '昨天';
      return this.queueDate;
    },
    isQueueToday() {
      return this.queueDate === Utils.today();
    },
    async advanceOrder(id) {
      try {
        const order = this.orders.find(o => o.id === id);
        if (!order) { alert('订单不存在'); return; }
        const flow = { pending: 'cooking', cooking: 'done', done: 'paid' };
        const nextStatus = flow[order.status];
        if (!nextStatus) return;
        order.status = nextStatus;
        if (nextStatus === 'paid') order.paidAt = Utils.now();
        order.updatedAt = Utils.now();
        await DB.put('orders', order);
      } catch(e) { alert('操作失败: ' + e.message); }
      await this.loadOrders();
    },
    async deleteOrder(id) {
      if (!confirm('确定删除此订单？')) return;
      await DB.delete('orders', id);
      await this.loadOrders();
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
      this.form = { categoryId: this.menuActiveCat || 'cat_main', name: '', priceType: 'per_serving', unitPrice: 0 };
      this.showDishForm = true;
    },
    openEditDish(dish) {
      this.editingDish = dish;
      this.form = {
        categoryId: dish.categoryId,
        name: dish.name,
        priceType: dish.priceType,
        unitPrice: dish.unitPrice
      };
      this.showDishForm = true;
    },
    closeDishForm() {
      this.showDishForm = false;
      this.editingDish = null;
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
      await DB.put('dishes', dish);
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

    // ---- 新建订单 ----
    getAvailDishes(catId) {
      return this.dishes.filter(d => d.categoryId === catId && d.available !== false);
    },
    addToCart(dish) {
      // 主菜弹出口味选择，其他直接加
      if (dish.categoryId === 'cat_main') {
        this.pendingFlavorDish = dish;
        this.selectedFlavor = '';
        this.pendingWeight = 1;
        this.showFlavorPicker = true;
        return;
      }
      // 非主菜直接加
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
    confirmFlavor() {
      const dish = this.pendingFlavorDish;
      if (!dish) return;
      // 按斤计价时校验斤数
      if (dish.priceType === 'per_jin' && (!this.pendingWeight || this.pendingWeight <= 0)) {
        alert('请输入有效斤数'); return;
      }
      const weight = this.pendingWeight || 1;
      // 同菜品+同口味累加，不同口味分开
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
      const order = this.orders.find(o => o.id === this.addItemsToOrderId);
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
          const order = this.orders.find(o => o.id === this.addItemsToOrderId);
          if (!order) { alert('订单不存在'); return; }
          // 加菜合并：同菜品+同口味累加，不同口味新增
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
      } catch(e) { alert('提交失败: ' + e.message); }

      // 重置表单并返回
      this.addItemsToOrderId = null;
      this.orderCart = [];
      this.orderTableNote = '';
      this.queueDate = Utils.today(); // 下单后自动切回今日,确保看到新单
      this.page = 'queue';
      await this.loadOrders();
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
      this.purchaseCateId = '';
      this.purchaseAmount = '';
      this.purchaseNote = '';
      await this.loadPurchases();
    },
    async deletePurchase(id) {
      if (!confirm('确定删除此采购记录？')) return;
      await DB.delete('purchases', id);
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
      const allOrders = this.orders;
      const allPurchases = this.purchases;

      let startDate = '', endDate = '';
      if (this.profitPeriod === 'day') {
        startDate = this.profitDate;
        endDate = this.profitDate;
      } else if (this.profitPeriod === 'week') {
        const range = this.getWeekRange(this.profitDate);
        startDate = range.start;
        endDate = range.end;
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

      // 营收
      const periodOrders = allOrders.filter(o => {
        if (!o.createdAt || o.status !== 'paid') return false;
        const d = o.createdAt.substring(0, 10);
        return d >= startDate && d <= endDate;
      });
      const revenue = periodOrders.reduce((sum, o) => sum + (o.totalAmount || 0), 0);

      // 采购成本
      const periodPurchases = allPurchases.filter(p => {
        return p.date >= startDate && p.date <= endDate;
      });
      const cost = periodPurchases.reduce((sum, p) => sum + (p.amount || 0), 0);
      const profit = Math.round((revenue - cost) * 100) / 100;
      const profitRate = revenue > 0 ? Math.round(profit / revenue * 10000) / 100 : 0;

      this.profitStats = {
        revenue: Math.round(revenue * 100) / 100,
        cost: Math.round(cost * 100) / 100,
        profit,
        profitRate,
        orderCount: periodOrders.length
      };

      // 按天汇总明细
      const dayMap = {};
      for (const o of periodOrders) {
        const d = o.createdAt.substring(0, 10);
        if (!dayMap[d]) dayMap[d] = { revenue: 0, cost: 0 };
        dayMap[d].revenue += o.totalAmount || 0;
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

    async loadReport() {
      const all = await DB.getAll('orders');
      let filtered = [];
      if (this.reportPeriod === 'day') {
        filtered = all.filter(o => o.createdAt && o.createdAt.startsWith(this.reportDate));
      } else if (this.reportPeriod === 'week') {
        const range = this.getWeekRange(this.reportDate);
        filtered = all.filter(o => {
          if (!o.createdAt) return false;
          const d = o.createdAt.substring(0, 10);
          return d >= range.start && d <= range.end;
        });
      } else if (this.reportPeriod === 'month') {
        filtered = all.filter(o => o.createdAt && o.createdAt.startsWith(this.reportMonth));
      } else if (this.reportPeriod === 'year') {
        filtered = all.filter(o => o.createdAt && o.createdAt.startsWith(String(this.reportYear)));
      }
      this.reportOrders = filtered.sort((a, b) => ((a.createdAt || '') > (b.createdAt || '') ? -1 : 1));
      const paidOrders = this.reportOrders.filter(o => o.status === 'paid');
      const doneOrders = this.reportOrders.filter(o => o.status === 'done');
      // 营业中统计所有未完成的订单，不限定周期
      const activeOrders = all.filter(o => o.status === 'pending' || o.status === 'cooking');
      this.reportStats = {
        total: this.reportOrders.length,
        paid: paidOrders.length,
        done: doneOrders.length + paidOrders.length,
        active: activeOrders.length,
        revenue: paidOrders.reduce((sum, o) => sum + (o.totalAmount || 0), 0)
      };
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

    // 每日自动备份
    const lastBackup = await DB.getMeta('lastBackupDate');
    if (lastBackup !== Utils.today()) {
      try {
        await Utils.exportData();
        await DB.setMeta('lastBackupDate', Utils.today());
      } catch(e) { /* 静默失败，不影响使用 */ }
    }
    await Utils.initDefaultData();
    await this.loadDishes();
    await this.loadOrders();
    await this.loadPurchaseCategories();
    await this.loadPurchases();
    await this.loadReport();

    this.$watch('page', async (newVal) => {
      if (newVal === 'queue') {
        await this.loadOrders();
      }
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
