/**
 * SenangWebs Index (SWI)
 * Searchable and paginated HTML views from JSON data.
 * Package metadata is the source of truth for the release version.
 */

function isElement(value) {
  return !!value && value.nodeType === 1 && typeof value.querySelector === 'function';
}

function validateData(data) {
  if (!Array.isArray(data)) throw new Error('SWI: Data must be an array of objects');
  if (Array.from(data).some(item => item === null || typeof item !== 'object' || Array.isArray(item))) {
    throw new Error('SWI: Data items must be non-null objects');
  }
}

function validatePageSize(value) {
  if (!Number.isSafeInteger(value) || value < 1) throw new Error('SWI: itemsPerPage must be a positive safe integer');
  return value;
}

function abortError() {
  const error = new Error('SWI: Initialization was cancelled');
  error.name = 'AbortError';
  return error;
}

class SenangWebsIndex {
  constructor(options = {}) {
    if (!options || typeof options !== 'object') throw new Error('SWI: options must be an object');
    if (!options.container) throw new Error('SWI: container selector is required');
    if (typeof options.itemTemplate !== 'function') throw new Error('SWI: itemTemplate function is required');
    if (Array.isArray(options.data)) validateData(options.data);
    else if (typeof options.data !== 'string' || !options.data.trim()) {
      throw new Error('SWI: data must be an array of objects or a nonempty JSON URL');
    }
    if (typeof options.container === 'string') {
      if (typeof document === 'undefined') throw new Error('SWI: a browser DOM is required');
      this.container = document.querySelector(options.container);
      if (!this.container) throw new Error(`SWI: container element not found: ${options.container}`);
    } else if (isElement(options.container)) this.container = options.container;
    else throw new Error('SWI: container must be a selector string or DOM element');

    this._document = this.container.ownerDocument;
    this.dataSource = options.data;
    this.itemTemplate = options.itemTemplate;
    this.searchConfig = this._parseSearchConfig(options.search);
    this.paginationConfig = this._parsePaginationConfig(options.pagination);
    this.data = [];
    this.filteredData = [];
    this.currentPage = 1;
    this.eventListeners = [];
    this._timers = new Set();
    this._query = '';
    this._destroyed = false;
    this._state = 'idle';
    this._originalBusy = this.container.getAttribute('aria-busy');
    this._originalTabIndex = this.container.getAttribute('tabindex');
    // Resolve and validate controls before changing the host's DOM.
    this._resolveControls();
    this._startInitialization();
  }

  _parseSearchConfig(search) {
    if (search != null && typeof search !== 'boolean' && typeof search !== 'object') {
      throw new Error('SWI: search must be a boolean or configuration object');
    }
    const config = search && typeof search === 'object' ? search : {};
    return {
      enabled: !!search && config.enabled !== false,
      selector: config.selector || null,
      searchKey: this._normalizeSearchKeys(config.searchKey),
      inputElement: config.inputElement || null,
      actionElement: config.actionElement || null
    };
  }

  _normalizeSearchKeys(searchKey = 'name') {
    const keys = Array.isArray(searchKey) ? searchKey : String(searchKey).split(',');
    const normalized = keys.map(key => String(key).trim()).filter(Boolean);
    return normalized.length ? normalized : ['name'];
  }

  _parsePaginationConfig(pagination) {
    if (pagination != null && typeof pagination !== 'boolean' && typeof pagination !== 'object') {
      throw new Error('SWI: pagination must be a boolean or configuration object');
    }
    const config = pagination && typeof pagination === 'object' ? pagination : {};
    return {
      enabled: !!pagination && config.enabled !== false,
      selector: config.selector || null,
      itemsPerPage: validatePageSize(config.itemsPerPage === undefined ? 10 : config.itemsPerPage),
      containerElement: config.containerElement || null
    };
  }

  _resolveControl(value, name) {
    const element = typeof value === 'string' ? this._document.querySelector(value) : value;
    if (!isElement(element)) throw new Error(`SWI: ${name} element not found or invalid`);
    if (element === this.container || this.container.contains(element)
      || (name === 'pagination' && element.contains(this.container))) {
      throw new Error(`SWI: ${name} must be outside the rendered item container`);
    }
    return element;
  }

  _resolveControls() {
    const search = this.searchConfig;
    if (search.enabled) {
      if (search.inputElement) search.inputElement = this._resolveControl(search.inputElement, 'search input');
      else if (search.selector) {
        const target = this._resolveControl(search.selector, 'search');
        search.inputElement = target.matches('input[type="text"], input[type="search"], input:not([type])')
          ? target : target.querySelector('input[type="text"], input[type="search"], input:not([type])');
        if (!search.inputElement) throw new Error('SWI: search input element not found');
      }
      if (search.inputElement && !search.inputElement.matches('input')) throw new Error('SWI: search input must be an input element');
      if (search.inputElement) search.inputElement = this._resolveControl(search.inputElement, 'search input');
      if (search.actionElement) search.actionElement = this._resolveControl(search.actionElement, 'search action');
    }
    const pagination = this.paginationConfig;
    if (pagination.enabled && (pagination.containerElement || pagination.selector)) {
      pagination.containerElement = this._resolveControl(pagination.containerElement || pagination.selector, 'pagination');
    }
  }

  _listen(element, event, handler) {
    element.addEventListener(event, handler);
    this.eventListeners.push({ element, event, handler });
  }

  _clearBindings() {
    this.eventListeners.forEach(({ element, event, handler }) => element.removeEventListener(event, handler));
    this.eventListeners = [];
    this._timers.forEach(timeout => clearTimeout(timeout));
    this._timers.clear();
    this._searchHandler = null;
  }

  _debounce(func, wait = 300) {
    let timeout;
    const cancel = () => {
      clearTimeout(timeout);
      this._timers.delete(timeout);
    };
    const handler = (...args) => {
      cancel();
      if (this._destroyed) return;
      timeout = setTimeout(() => {
        this._timers.delete(timeout);
        if (!this._destroyed) func.apply(this, args);
      }, wait);
      this._timers.add(timeout);
    };
    handler.cancel = cancel;
    return handler;
  }

  _node(tag, className, text) {
    const node = this._document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = String(text);
    return node;
  }

  _clearPagination() {
    if (this.paginationConfig.enabled && this.paginationConfig.containerElement) {
      this.paginationConfig.containerElement.replaceChildren();
    }
  }

  _status(className, icon, heading, message, role = 'status') {
    const status = this._node('div', className);
    status.setAttribute('role', role);
    status.setAttribute('aria-live', role === 'alert' ? 'assertive' : 'polite');
    const iconNode = this._node('div', `${className}-icon`, icon);
    iconNode.setAttribute('aria-hidden', 'true');
    status.append(iconNode, this._node('h3', '', heading));
    if (message) status.append(this._node('p', '', message));
    return status;
  }

  _wrapState(state, hidden = false) {
    if (this.container.matches('tbody, thead, tfoot')) {
      const row = this._node('tr', hidden ? 'swi-sr-only' : 'swi-state-row');
      const cell = this._node('td');
      cell.colSpan = Math.max(1, this.container.closest('table')?.querySelector('tr')?.children.length || 1);
      cell.append(state);
      row.append(cell);
      return row;
    }
    if (this.container.matches('ul, ol')) {
      const item = this._node('li', hidden ? 'swi-sr-only' : 'swi-state-item');
      item.append(state);
      return item;
    }
    return state;
  }

  _replaceState(state) {
    this.container.replaceChildren(this._wrapState(state));
  }

  showLoading() {
    if (this._destroyed) return;
    const loading = this._node('div', 'swi-loading');
    loading.setAttribute('role', 'status');
    loading.setAttribute('aria-live', 'polite');
    const spinner = this._node('div', 'swi-spinner');
    spinner.setAttribute('aria-hidden', 'true');
    loading.append(spinner, this._node('p', '', 'Loading data...'));
    this.container.setAttribute('aria-busy', 'true');
    this._replaceState(loading);
    this._clearPagination();
  }

  hideLoading() {
    if (this._destroyed) return;
    const loading = this.container.querySelector('.swi-loading');
    if (loading) (loading.closest('.swi-state-row, .swi-state-item') || loading).remove();
    this.container.setAttribute('aria-busy', 'false');
  }

  showError(message, details = '') {
    if (this._destroyed) return;
    if (!this.eventListeners.some(listener => listener.handler === this._retryHandler)) {
      this._retryHandler = event => {
        if (!event.target.closest?.('.swi-error-retry') || this._destroyed) return;
        event.preventDefault();
        this._startInitialization();
      };
      this._listen(this.container, 'click', this._retryHandler);
    }
    const error = this._status('swi-error', '\u26a0\ufe0f', message, '', 'alert');
    if (details) error.append(this._node('p', 'swi-error-details', details));
    const retry = this._node('button', 'swi-error-retry', 'Retry');
    retry.type = 'button';
    error.append(retry);
    this.container.setAttribute('aria-busy', 'false');
    this._replaceState(error);
    this._clearPagination();
  }

  _startInitialization() {
    if (this._destroyed) return;
    this._operation?.controller.abort();
    this._clearBindings();
    const operation = { controller: new AbortController() };
    this._operation = operation;
    this._state = 'loading';
    const signal = operation.controller.signal;
    let rejectAbort;
    const cancelled = new Promise((resolve, reject) => { rejectAbort = () => reject(abortError()); });
    signal.addEventListener('abort', rejectAbort, { once: true });
    this.ready = Promise.race([this._init(operation), cancelled])
      .finally(() => signal.removeEventListener('abort', rejectAbort));
    // Observe rejection without changing the rejecting promise exposed to awaiters.
    this.ready.catch(() => {});
  }

  _assertActive(operation) {
    if (this._destroyed || this._operation !== operation || operation.controller.signal.aborted) throw abortError();
  }

  async _init(operation) {
    try {
      this.showLoading();
      await this._loadData(operation);
      this._assertActive(operation);
      this._state = 'ready';
      this.hideLoading();
      this._setupSearch();
      this._setupPagination();
      this.search(this._query);
      this._assertActive(operation);
      return this;
    } catch (error) {
      if (!this._destroyed && this._operation === operation && !operation.controller.signal.aborted) {
        this._state = 'error';
        this._clearBindings();
        this.showError('Failed to load data', error.message);
      }
      throw error;
    }
  }

  async _loadData(operation = this._operation) {
    let data = this.dataSource;
    if (typeof data === 'string') {
      const response = await fetch(data, { signal: operation.controller.signal });
      this._assertActive(operation);
      if (!response.ok) throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      data = await response.json();
    }
    this._assertActive(operation);
    validateData(data);
    this.data = [...data];
    this.filteredData = [...data];
  }

  _setupSearch() {
    const { enabled, inputElement, actionElement } = this.searchConfig;
    if (!enabled || !inputElement) return;
    this._searchHandler = this._debounce(query => this.search(query));
    this._listen(inputElement, 'input', () => this._searchHandler(inputElement.value));
    if (actionElement) {
      this._listen(actionElement, 'click', event => {
        event.preventDefault();
        this._searchHandler.cancel();
        this.search(inputElement.value);
      });
    }
  }

  _setupPagination() {
    const { enabled, containerElement } = this.paginationConfig;
    if (!enabled || !containerElement) return;
    this._listen(containerElement, 'click', event => {
      const button = event.target.closest?.('.swi-pagination-btn');
      if (!button || !containerElement.contains(button) || button.disabled) return;
      event.preventDefault();
      this.goToPage(Number(button.dataset.page));
    });
  }

  search(query, searchKey = this.searchConfig.searchKey) {
    if (this._destroyed) return;
    const keys = this._normalizeSearchKeys(searchKey);
    const text = query == null ? '' : String(query);
    this._query = text;
    const lower = text.toLowerCase();
    this.filteredData = text.trim() === '' ? [...this.data] : this.data.filter(item =>
      keys.some(key => item[key] != null && String(item[key]).toLowerCase().includes(lower)));
    this.currentPage = 1;
    this.render();
  }

  render() {
    if (this._destroyed || this._state === 'loading') return;
    const operation = this._operation;
    const paginated = this._getPaginatedData();
    const fragment = this._document.createDocumentFragment();
    const elements = new Set();
    paginated.forEach(item => {
      if (this._destroyed || this._operation !== operation || this._state === 'loading') return;
      const result = this.itemTemplate(item);
      const element = isElement(result) ? result : this._createElementFromHTML(result);
      if (elements.has(element)) throw new Error('SWI: itemTemplate must return a separate element for each item');
      elements.add(element);
    });
    if (this._destroyed || this._operation !== operation || this._state === 'loading') return;
    elements.forEach(element => fragment.append(element));
    // Validate rendered items before replacing the previous view.
    if (!paginated.length) {
      const empty = this._status('swi-empty-state', '\ud83d\udced', 'No Results', this.data.length
        ? 'No results found. Try a different search term.' : 'No data available');
      fragment.append(this._wrapState(empty));
    } else {
      const announcement = this._node('p', 'swi-sr-only',
        `${this.filteredData.length} results. Page ${this.currentPage} of ${this.paginationConfig.enabled
          ? Math.ceil(this.filteredData.length / this.paginationConfig.itemsPerPage) : 1}.`);
      announcement.setAttribute('role', 'status');
      announcement.setAttribute('aria-live', 'polite');
      fragment.append(this._wrapState(announcement, true));
    }
    this.container.replaceChildren(fragment);
    this.container.setAttribute('aria-busy', 'false');
    if (this.paginationConfig.enabled && this.paginationConfig.containerElement) this._renderPagination();
  }

  _getPaginatedData() {
    if (!this.paginationConfig.enabled) return this.filteredData;
    const start = (this.currentPage - 1) * this.paginationConfig.itemsPerPage;
    return this.filteredData.slice(start, start + this.paginationConfig.itemsPerPage);
  }

  _renderPagination() {
    const container = this.paginationConfig.containerElement;
    const active = this._document.activeElement;
    const focusKey = container.contains(active) ? active.dataset.swiFocus : null;
    const total = Math.ceil(this.filteredData.length / this.paginationConfig.itemsPerPage);
    if (total <= 1) {
      container.replaceChildren();
      if (focusKey) {
        if (this.searchConfig.inputElement) this.searchConfig.inputElement.focus();
        else {
          this.container.setAttribute('tabindex', '-1');
          this.container.focus();
        }
      }
      return;
    }
    const navigation = this._node('nav');
    navigation.setAttribute('aria-label', 'Results pages');
    const list = this._node('ul', 'swi-pagination-list');
    const addButton = (page, text, key, disabled = false) => {
      const li = this._node('li', `swi-pagination-item${disabled ? ' swi-disabled' : ''}${key === String(this.currentPage) ? ' swi-active' : ''}`);
      const button = this._node('button', 'swi-pagination-btn', text);
      button.type = 'button';
      button.dataset.page = String(page);
      button.dataset.swiFocus = key;
      button.disabled = disabled;
      if (key === String(this.currentPage)) button.setAttribute('aria-current', 'page');
      if (key !== 'previous' && key !== 'next') button.setAttribute('aria-label', `Page ${page}`);
      li.append(button);
      list.append(li);
    };
    addButton(this.currentPage - 1, 'Previous', 'previous', this.currentPage === 1);
    const pages = new Set([1, total]);
    for (let page = Math.max(1, this.currentPage - 2); page <= Math.min(total, this.currentPage + 2); page++) pages.add(page);
    let previous = 0;
    [...pages].sort((a, b) => a - b).forEach(page => {
      if (previous && page - previous > 1) {
        const ellipsis = this._node('li', 'swi-pagination-ellipsis', '\u2026');
        ellipsis.setAttribute('aria-hidden', 'true');
        list.append(ellipsis);
      }
      addButton(page, page, String(page));
      previous = page;
    });
    addButton(this.currentPage + 1, 'Next', 'next', this.currentPage === total);
    navigation.append(list);
    container.replaceChildren(navigation);
    if (focusKey) {
      const buttons = [...container.querySelectorAll('button')];
      const preferred = buttons.find(button => button.dataset.swiFocus === focusKey && !button.disabled);
      (preferred || buttons.find(button => button.getAttribute('aria-current') === 'page')).focus();
    }
  }

  goToPage(pageNumber) {
    if (this._destroyed || this._state === 'loading' || !this.paginationConfig.enabled) return;
    const total = Math.ceil(this.filteredData.length / this.paginationConfig.itemsPerPage);
    if (!Number.isSafeInteger(pageNumber) || pageNumber < 1 || pageNumber > total) return;
    this.currentPage = pageNumber;
    this.render();
  }

  _createElementFromHTML(html) {
    if (typeof html !== 'string' || !html.trim()) throw new Error('SWI: itemTemplate must return a nonempty HTML string or Element');
    const template = this._document.createElement('template');
    template.innerHTML = html.trim();
    const nodes = [...template.content.childNodes].filter(node => node.nodeType !== 8
      && !(node.nodeType === 3 && !node.textContent.trim()));
    if (nodes.length !== 1 || !isElement(nodes[0])) throw new Error('SWI: HTML templates must contain exactly one root element');
    return nodes[0];
  }

  destroy() {
    if (this._destroyed) return;
    this._destroyed = true;
    this._state = 'destroyed';
    this._operation?.controller.abort();
    this._clearBindings();
    this.container.replaceChildren();
    this._clearPagination();
    if (this._originalBusy === null) this.container.removeAttribute('aria-busy');
    else this.container.setAttribute('aria-busy', this._originalBusy);
    if (this._originalTabIndex === null) this.container.removeAttribute('tabindex');
    else this.container.setAttribute('tabindex', this._originalTabIndex);
    if (this._declarative) {
      const { host, id, template, parent, nextSibling, wrapper } = this._declarative;
      if (!wrapper) parent.insertBefore(template, nextSibling?.parentNode === parent ? nextSibling : null);
      else wrapper.remove();
      if (SWIDeclarativeHandler.instances.get(id) === this) SWIDeclarativeHandler.instances.delete(id);
      SWIDeclarativeHandler.containers.delete(host);
      this._declarative = null;
    }
    this.data = [];
    this.filteredData = [];
    this.dataSource = null;
    this.itemTemplate = null;
    this.searchConfig.inputElement = null;
    this.searchConfig.actionElement = null;
    this.paginationConfig.containerElement = null;
    this._retryHandler = null;
    this._operation = null;
  }
}

class SWIDeclarativeHandler {
  static instances = new Map();
  static containers = new WeakMap();

  static init() {
    document.querySelectorAll('[data-swi-id]').forEach(container => {
      try { SWIDeclarativeHandler.createInstance(container); }
      catch (error) { console.error('SWI: Failed to initialize declarative instance', error); }
    });
  }

  static createInstance(container) {
    const existing = this.containers.get(container);
    if (existing && !existing._destroyed) return existing;
    const id = container.getAttribute('data-swi-id');
    const source = container.getAttribute('data-swi-source');
    if (!id?.trim() || !source?.trim()) throw new Error('SWI: data-swi-id and data-swi-source are required');
    if (this.instances.has(id)) throw new Error(`SWI: duplicate data-swi-id: ${id}`);
    const attribute = container.getAttribute('data-swi-page-size');
    const pageSize = attribute === null ? 10 : /^\d+$/.test(attribute.trim())
      ? validatePageSize(Number(attribute)) : validatePageSize(NaN);
    const owned = selector => [...container.querySelectorAll(selector)]
      .find(element => element.closest('[data-swi-id]') === container);
    const template = owned('[data-swi-template="item"]');
    if (!template) throw new Error('SWI: data-swi-template="item" element not found');
    const parent = template.parentElement;
    const nextSibling = template.nextSibling;
    const input = owned('[data-swi-search-input]');
    const action = owned('[data-swi-search-action]');
    const pagination = owned('[data-swi-pagination]');
    if (input && !input.matches('input')) throw new Error('SWI: search input must be an input element');
    if (parent !== container && [input, action, pagination].some(element => element && parent.contains(element))) {
      throw new Error('SWI: search and pagination controls must be outside the item wrapper');
    }
    if (parent !== container && parent.querySelector('[data-swi-id]')) throw new Error('SWI: nested instances must be outside the item wrapper');
    const wrapper = parent === container ? container.ownerDocument.createElement('div') : null;
    if (wrapper) {
      wrapper.className = 'swi-item-container';
      parent.insertBefore(wrapper, template);
    }
    template.style.display = 'none';
    const itemTemplate = this.createTemplateFunction(template);
    if (!wrapper) template.remove();
    let instance;
    try {
      instance = new SenangWebsIndex({
        container: wrapper || parent, data: source, itemTemplate,
        search: { enabled: !!input, inputElement: input, actionElement: action,
          searchKey: container.getAttribute('data-swi-search-key') || 'name' },
        pagination: { enabled: !!pagination, containerElement: pagination, itemsPerPage: pageSize }
      });
    } catch (error) {
      if (wrapper) wrapper.remove();
      else parent.insertBefore(template, nextSibling?.parentNode === parent ? nextSibling : null);
      throw error;
    }
    instance._declarative = { host: container, id, template, parent, nextSibling, wrapper };
    this.instances.set(id, instance);
    this.containers.set(container, instance);
    return instance;
  }

  static createTemplateFunction(templateElement) {
    return item => {
      const clone = templateElement.cloneNode(true);
      clone.style.display = '';
      clone.removeAttribute('data-swi-template');
      clone.classList.add('swi-item');
      const values = [...clone.querySelectorAll('[data-swi-value]')];
      if (clone.hasAttribute('data-swi-value')) values.unshift(clone);
      values.forEach(element => {
        const key = element.getAttribute('data-swi-value').replace(/^item\./, '');
        element.textContent = item[key] == null ? '' : String(item[key]);
      });
      return clone;
    };
  }

  static getInstance(id) { return this.instances.get(id); }

  static destroyAll() {
    [...this.instances.values()].forEach(instance => instance.destroy());
    this.instances.clear();
  }
}

if (typeof window !== 'undefined' && typeof document !== 'undefined') {
  window.SenangWebsIndex = SenangWebsIndex;
  window.SWI = SenangWebsIndex;
  window.SWIDeclarativeHandler = SWIDeclarativeHandler;
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => SWIDeclarativeHandler.init(), { once: true });
  } else SWIDeclarativeHandler.init();
}

export default SenangWebsIndex;
export { SenangWebsIndex, SenangWebsIndex as SWI, SWIDeclarativeHandler };
