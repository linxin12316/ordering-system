// js/app.js — Vue 应用入口（所有页面逻辑合并在根组件）
const app = Vue.createApp({
  data() {
    return {
      // 导航
      page: 'queue',
      statusFilter: '',

      // 共享数据
      orders: [],
      dishes: [],
      categories: [],

      // === 菜单管理 ===
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
      flavorOptions: [
        { value: '酸汤', label: '酸汤' },
        { value: '青椒', label: '青椒' },
        { value: '清汤', label: '清汤' },
        { value: '鸳鸯(酸汤+青椒)', label: '鸳鸯(酸汤+青椒)' },
        { value: '鸳鸯(酸汤+清汤)', label: '鸳鸯(酸汤+清汤)' },
        { value: '鸳鸯(青椒+清汤)', label: '鸳鸯(青椒+清汤)' },
      ],

      // === 每日报表 ===
      reportDate: '',
      reportPeriod: 'day',
      reportMonth: '',
      reportYear: 2026,
      reportWeek: '',
      reportOrders: [],
      reportStats: { total: 0, paid: 0, done: 0, revenue: 0 }
    };
  },

  computed: {
    // ---- 订单队列 ----
    filteredOrders() {
      if (!this.statusFilter) return this.orders;
      return this.orders.filter(o => o.status === this.statusFilter);
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
        if (!confirm(`将导入 ${data.dishes.length} 条菜品/分类、${data.orders.length} 条订单数据，是否覆盖当前数据？`)) return;

        // 清空旧数据
        const oldDishes = await DB.getAll('dishes');
        for (const d of oldDishes) await DB.delete('dishes', d.id);
        const oldOrders = await DB.getAll('orders');
        for (const o of oldOrders) await DB.delete('orders', o.id);

        // 写入新数据
        for (const d of data.dishes) await DB.put('dishes', d);
        for (const o of data.orders) await DB.put('orders', o);

        // 重置备份标记，下次自动备份
        await DB.setMeta('lastBackupDate', '');

        alert(`✅ 导入成功！${data.dishes.length} 条菜品/分类，${data.orders.length} 条订单`);
        await this.loadDishes();
        await this.loadOrders();
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
      return this.dishes.filter(d => d.categoryId === catId)
        .sort((a, b) => (a.createdAt || '') > (b.createdAt || '') ? -1 : 1);
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
      if (!this.form.unitPrice || this.form.unitPrice <= 0) { alert('请输入有效价格'); return; }
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
      // 同菜品+同口味累加，不同口味分开
      const sameItem = this.orderCart.find(
        item => item.dishId === dish.id && item.flavor === (this.selectedFlavor || '')
      );
      if (sameItem) {
        if (sameItem.priceType === 'per_jin') {
          sameItem.weight = (sameItem.weight || 0) + 1;
        } else {
          sameItem.quantity = (sameItem.quantity || 0) + 1;
        }
        this.recalcItem(sameItem);
      } else {
        this.orderCart.push({
          dishId: dish.id, name: dish.name, categoryId: dish.categoryId,
          priceType: dish.priceType, unitPrice: dish.unitPrice,
          quantity: dish.priceType === 'per_jin' ? 0 : 1,
          weight: dish.priceType === 'per_jin' ? 1 : 0,
          subtotal: dish.unitPrice,
          flavor: this.selectedFlavor || ''
        });
      }
      this.showFlavorPicker = false;
      this.pendingFlavorDish = null;
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
      this.page = 'queue';
      await this.loadOrders();
    },

    // ---- 报表 ----
    switchPeriod(period) {
      this.reportPeriod = period;
      if (period === 'month') this.reportMonth = Utils.today().substring(0, 7);
      if (period === 'year') this.reportYear = parseInt(Utils.today().substring(0, 4));
      this.loadReport();
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
    this.reportDate = Utils.today();
    this.reportMonth = Utils.today().substring(0, 7);
    this.reportYear = parseInt(Utils.today().substring(0, 4));
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
    await this.loadReport();

    this.$watch('page', async (newVal) => {
      if (newVal === 'queue') { await this.loadOrders(); }
      if (newVal === 'report') { await this.loadReport(); }
      if (newVal === 'order' && !this.addItemsToOrderId) {
        this.orderCart = [];
        this.orderTableNote = '';
      }
    });
  }
});

app.mount('#app');
