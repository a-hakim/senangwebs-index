/**
 * SenangWebs Index (SWI)
 * A lightweight JavaScript library for transforming JSON data into searchable and paginated HTML views
 * @version 1.0.0
 */

class SenangWebsIndex {
  constructor(options = {}) {
    // Validate required options for programmatic initialization
    if (!options.container) {
      throw new Error('SWI: container selector is required');
    }
    if (!options.data) {
      throw new Error('SWI: data source is required');
    }
    if (!options.itemTemplate && typeof options.itemTemplate !== 'function') {
      throw new Error('SWI: itemTemplate function is required');
    }

    // Store configuration - handle both selector strings and direct elements
    if (typeof options.container === 'string') {
      this.container = document.querySelector(options.container);
      if (!this.container) {
        throw new Error(`SWI: container element not found: ${options.container}`);
      }
    } else if (options.container instanceof Element) {
      this.container = options.container;
    } else {
      throw new Error('SWI: container must be a selector string or DOM element');
    }

    this.dataSource = options.data;
    this.itemTemplate = options.itemTemplate;
    this.data = [];
    this.filteredData = [];
    this.currentPage = 1;
    
    // Search configuration
    this.searchConfig = this._parseSearchConfig(options.search);
    
    // Pagination configuration
    this.paginationConfig = this._parsePaginationConfig(options.pagination);
    
    // Store event listeners for cleanup
    this.eventListeners = [];

    // Initialize
    this._init();
  }

  /**
   * Parse search configuration
   */
  _parseSearchConfig(search) {
    if (!search) {
      return { enabled: false };
    }

    if (typeof search === 'boolean') {
      return { enabled: search };
    }

    return {
      enabled: search.enabled !== false,
      selector: search.selector || null,
      searchKey: search.searchKey || 'name',
      inputElement: null,
      actionElement: null
    };
  }

  /**
   * Parse pagination configuration
   */
  _parsePaginationConfig(pagination) {
    if (!pagination) {
      return { enabled: false, itemsPerPage: 10 };
    }

    if (typeof pagination === 'boolean') {
      return { enabled: pagination, itemsPerPage: 10 };
    }

    return {
      enabled: pagination.enabled !== false,
      selector: pagination.selector || null,
      itemsPerPage: pagination.itemsPerPage || 10,
      containerElement: null
    };
  }

  /**
   * Initialize the library
   */
  async _init() {
    try {
      // Load data
      await this._loadData();
      
      // Setup search if enabled
      if (this.searchConfig.enabled && this.searchConfig.selector) {
        this._setupSearch();
      }
      
      // Setup pagination if enabled
      if (this.paginationConfig.enabled && this.paginationConfig.selector) {
        this.paginationConfig.containerElement = document.querySelector(this.paginationConfig.selector);
      }
      
      // Initial render
      this.render();
    } catch (error) {
      console.error('SWI: Initialization failed', error);
      throw error;
    }
  }

  /**
   * Load data from source
   */
  async _loadData() {
    if (Array.isArray(this.dataSource)) {
      this.data = this.dataSource;
      this.filteredData = [...this.data];
    } else if (typeof this.dataSource === 'string') {
      try {
        const response = await fetch(this.dataSource);
        if (!response.ok) {
          throw new Error(`Failed to fetch data: ${response.statusText}`);
        }
        this.data = await response.json();
        this.filteredData = [...this.data];
      } catch (error) {
        console.error('SWI: Failed to load data', error);
        throw error;
      }
    }
  }

  /**
   * Setup search functionality
   */
  _setupSearch() {
    const searchContainer = document.querySelector(this.searchConfig.selector);
    if (!searchContainer) return;

    this.searchConfig.inputElement = searchContainer.querySelector('input[type="text"]');
    
    if (this.searchConfig.inputElement) {
      const searchHandler = (e) => {
        this.search(e.target.value);
      };
      
      this.searchConfig.inputElement.addEventListener('input', searchHandler);
      this.eventListeners.push({
        element: this.searchConfig.inputElement,
        event: 'input',
        handler: searchHandler
      });
    }
  }

  /**
   * Perform search
   */
  search(query) {
    const searchKey = this.searchConfig.searchKey;
    
    if (!query || query.trim() === '') {
      this.filteredData = [...this.data];
    } else {
      const lowerQuery = query.toLowerCase();
      this.filteredData = this.data.filter(item => {
        const value = item[searchKey];
        return value && value.toString().toLowerCase().includes(lowerQuery);
      });
    }
    
    this.currentPage = 1;
    this.render();
  }

  /**
   * Render the data
   */
  render() {
    // Clear container
    this.container.innerHTML = '';
    
    // Get paginated data
    const paginatedData = this._getPaginatedData();
    
    // Render items
    paginatedData.forEach(item => {
      const itemHTML = this.itemTemplate(item);
      const itemElement = this._createElementFromHTML(itemHTML);
      this.container.appendChild(itemElement);
    });
    
    // Render pagination
    if (this.paginationConfig.enabled && this.paginationConfig.containerElement) {
      this._renderPagination();
    }
  }

  /**
   * Get paginated data for current page
   */
  _getPaginatedData() {
    if (!this.paginationConfig.enabled) {
      return this.filteredData;
    }
    
    const start = (this.currentPage - 1) * this.paginationConfig.itemsPerPage;
    const end = start + this.paginationConfig.itemsPerPage;
    return this.filteredData.slice(start, end);
  }

  /**
   * Render pagination controls
   */
  _renderPagination() {
    const totalPages = Math.ceil(this.filteredData.length / this.paginationConfig.itemsPerPage);
    
    if (totalPages <= 1) {
      this.paginationConfig.containerElement.innerHTML = '';
      return;
    }
    
    let paginationHTML = '<ul class="swi-pagination-list">';
    
    // Previous button
    paginationHTML += `
      <li class="swi-pagination-item ${this.currentPage === 1 ? 'swi-disabled' : ''}">
        <button class="swi-pagination-btn" data-page="${this.currentPage - 1}" ${this.currentPage === 1 ? 'disabled' : ''}>
          Previous
        </button>
      </li>
    `;
    
    // Page numbers
    for (let i = 1; i <= totalPages; i++) {
      paginationHTML += `
        <li class="swi-pagination-item ${i === this.currentPage ? 'swi-active' : ''}">
          <button class="swi-pagination-btn" data-page="${i}">
            ${i}
          </button>
        </li>
      `;
    }
    
    // Next button
    paginationHTML += `
      <li class="swi-pagination-item ${this.currentPage === totalPages ? 'swi-disabled' : ''}">
        <button class="swi-pagination-btn" data-page="${this.currentPage + 1}" ${this.currentPage === totalPages ? 'disabled' : ''}>
          Next
        </button>
      </li>
    `;
    
    paginationHTML += '</ul>';
    
    this.paginationConfig.containerElement.innerHTML = paginationHTML;
    
    // Add event listeners to pagination buttons
    const buttons = this.paginationConfig.containerElement.querySelectorAll('.swi-pagination-btn');
    buttons.forEach(button => {
      const clickHandler = (e) => {
        e.preventDefault();
        const page = parseInt(button.dataset.page);
        if (page >= 1 && page <= totalPages) {
          this.goToPage(page);
        }
      };
      
      button.addEventListener('click', clickHandler);
      this.eventListeners.push({
        element: button,
        event: 'click',
        handler: clickHandler
      });
    });
  }

  /**
   * Navigate to a specific page
   */
  goToPage(pageNumber) {
    const totalPages = Math.ceil(this.filteredData.length / this.paginationConfig.itemsPerPage);
    
    if (pageNumber < 1 || pageNumber > totalPages) {
      return;
    }
    
    this.currentPage = pageNumber;
    this.render();
  }

  /**
   * Create DOM element from HTML string
   */
  _createElementFromHTML(htmlString) {
    const template = document.createElement('template');
    template.innerHTML = htmlString.trim();
    return template.content.firstChild;
  }

  /**
   * Destroy the instance and cleanup
   */
  destroy() {
    // Remove event listeners
    this.eventListeners.forEach(({ element, event, handler }) => {
      element.removeEventListener(event, handler);
    });
    
    // Clear container
    if (this.container) {
      this.container.innerHTML = '';
    }
    
    // Clear pagination
    if (this.paginationConfig.containerElement) {
      this.paginationConfig.containerElement.innerHTML = '';
    }
    
    // Clear references
    this.data = [];
    this.filteredData = [];
    this.eventListeners = [];
  }
}

/**
 * Declarative Initialization Handler
 * Automatically initializes SWI instances from HTML attributes
 */
class SWIDeclarativeHandler {
  static instances = new Map();

  /**
   * Initialize all declarative SWI instances in the DOM
   */
  static init() {
    const containers = document.querySelectorAll('[data-swi-id]');
    
    containers.forEach(container => {
      try {
        const instance = SWIDeclarativeHandler.createInstance(container);
        if (instance) {
          const id = container.getAttribute('data-swi-id');
          SWIDeclarativeHandler.instances.set(id, instance);
        }
      } catch (error) {
        console.error('SWI: Failed to initialize declarative instance', error);
      }
    });
  }

  /**
   * Create an SWI instance from a declarative container
   */
  static createInstance(container) {
    const id = container.getAttribute('data-swi-id');
    const source = container.getAttribute('data-swi-source');
    
    if (!id || !source) {
      console.warn('SWI: data-swi-id and data-swi-source are required');
      return null;
    }

    // Get configuration from attributes
    const pageSize = parseInt(container.getAttribute('data-swi-page-size')) || 10;
    const searchKey = container.getAttribute('data-swi-search-key') || 'name';
    
    // Find template element
    const templateElement = container.querySelector('[data-swi-template="item"]');
    if (!templateElement) {
      console.warn('SWI: data-swi-template="item" element not found');
      return null;
    }
    
    // Find container for rendered items (parent of template or container itself)
    const itemContainer = templateElement.parentElement;
    
    // Find search input and action
    const searchInput = container.querySelector('[data-swi-search-input]');
    const searchAction = container.querySelector('[data-swi-search-action]');
    
    // Find pagination container
    const paginationContainer = container.querySelector('[data-swi-pagination]');
    
    // Create a wrapper for items if template is direct child
    let renderContainer = itemContainer;
    if (itemContainer === container) {
      const wrapper = document.createElement('div');
      wrapper.className = 'swi-item-container';
      templateElement.parentElement.insertBefore(wrapper, templateElement);
      renderContainer = wrapper;
    }
    
    // Hide the template
    templateElement.style.display = 'none';
    
    // Create item template function
    const itemTemplate = SWIDeclarativeHandler.createTemplateFunction(templateElement);
    
    // Create instance configuration
    const config = {
      container: renderContainer,
      data: source,
      itemTemplate: itemTemplate,
      pagination: {
        enabled: !!paginationContainer,
        selector: paginationContainer ? `#${paginationContainer.id || 'swi-pagination-' + id}` : null,
        itemsPerPage: pageSize
      },
      search: {
        enabled: !!searchInput,
        selector: searchInput ? null : null,
        searchKey: searchKey,
        inputElement: searchInput,
        actionElement: searchAction
      }
    };
    
    // Assign ID to pagination container if it doesn't have one
    if (paginationContainer && !paginationContainer.id) {
      paginationContainer.id = 'swi-pagination-' + id;
      config.pagination.selector = '#' + paginationContainer.id;
    }
    
    // Create custom instance with declarative setup
    return new SWIDeclarativeInstance(config);
  }

  /**
   * Create template function from declarative template element
   */
  static createTemplateFunction(templateElement) {
    return (item) => {
      // Clone the template
      const clone = templateElement.cloneNode(true);
      clone.style.display = '';
      clone.removeAttribute('data-swi-template');
      clone.classList.add('swi-item');
      
      // Find all elements with data-swi-value
      const valueElements = clone.querySelectorAll('[data-swi-value]');
      
      valueElements.forEach(element => {
        const valuePath = element.getAttribute('data-swi-value');
        // Extract key from path like "item.name" -> "name"
        const key = valuePath.replace(/^item\./, '');
        
        // Set the text content
        if (item[key] !== undefined && item[key] !== null) {
          element.textContent = item[key];
        }
      });
      
      return clone.outerHTML;
    };
  }

  /**
   * Get instance by ID
   */
  static getInstance(id) {
    return SWIDeclarativeHandler.instances.get(id);
  }

  /**
   * Destroy all instances
   */
  static destroyAll() {
    SWIDeclarativeHandler.instances.forEach(instance => {
      instance.destroy();
    });
    SWIDeclarativeHandler.instances.clear();
  }
}

/**
 * Extended SWI instance for declarative initialization
 */
class SWIDeclarativeInstance extends SenangWebsIndex {
  constructor(config) {
    // Prepare proper options for parent constructor
    const options = {
      container: config.container,
      data: config.data,
      itemTemplate: config.itemTemplate,
      search: config.search || { enabled: false },
      pagination: config.pagination || { enabled: false }
    };
    
    // Call parent constructor properly
    super(options);
    
    // Store declarative-specific elements
    this.searchConfig.inputElement = config.search?.inputElement || null;
    this.searchConfig.actionElement = config.search?.actionElement || null;
  }

  async _init() {
    try {
      // Load data
      await this._loadData();
      
      // Setup declarative search
      if (this.searchConfig.enabled && this.searchConfig.inputElement) {
        this._setupDeclarativeSearch();
      }
      
      // Setup pagination
      if (this.paginationConfig.enabled && this.paginationConfig.selector) {
        this.paginationConfig.containerElement = document.querySelector(this.paginationConfig.selector);
      }
      
      // Initial render
      this.render();
    } catch (error) {
      console.error('SWI: Initialization failed', error);
      throw error;
    }
  }

  _setupDeclarativeSearch() {
    const inputElement = this.searchConfig.inputElement;
    const actionElement = this.searchConfig.actionElement;
    
    if (inputElement) {
      const searchHandler = (e) => {
        this.search(e.target.value);
      };
      
      inputElement.addEventListener('input', searchHandler);
      this.eventListeners.push({
        element: inputElement,
        event: 'input',
        handler: searchHandler
      });
      
      // If action element exists, trigger search on click
      if (actionElement) {
        const clickHandler = (e) => {
          e.preventDefault();
          this.search(inputElement.value);
        };
        
        actionElement.addEventListener('click', clickHandler);
        this.eventListeners.push({
          element: actionElement,
          event: 'click',
          handler: clickHandler
        });
      }
    }
  }
}

// Auto-initialize on DOM ready
if (typeof window !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      SWIDeclarativeHandler.init();
    });
  } else {
    // DOM is already ready
    SWIDeclarativeHandler.init();
  }
}

// Export for module systems
export default SenangWebsIndex;
export { SenangWebsIndex, SWIDeclarativeHandler };

// Global exposure for UMD
if (typeof window !== 'undefined') {
  window.SenangWebsIndex = SenangWebsIndex;
  window.SWI = SenangWebsIndex;
  window.SWIDeclarativeHandler = SWIDeclarativeHandler;
}
