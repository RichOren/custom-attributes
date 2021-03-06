(function(){
var forEach = Array.prototype.forEach;

class CustomAttributeRegistry {
  constructor(ownerDocument){
    if(!ownerDocument) {
      throw new Error("Must be given a document");
    }

    this.ownerDocument = ownerDocument;
    this._attrMap = new Map();
    this._elementMap = new WeakMap();
    this._observe();
  }

  define(attrName, Constructor) {
    this._attrMap.set(attrName, Constructor);
    this._upgradeAttr(attrName);
  }

  get(element, attrName) {
    var map = this._elementMap.get(element);
    if(!map) return;
    return map.get(attrName);
  }

  _getConstructor(attrName){
    return this._attrMap.get(attrName);
  }

  _observe(){
    var customAttributes = this;
    var document = this.ownerDocument;
    var root = document.documentElement;
    var downgrade = this._downgrade.bind(this);
    var upgrade = this._upgradeElement.bind(this);

    this.observer = new MutationObserver(function(mutations){
      forEach.call(mutations, function(m){
        if(m.type === 'attributes') {
          var attr = customAttributes._getConstructor(m.attributeName);
          if(attr) {
            customAttributes._found(m.attributeName, m.target, m.oldValue);
          }
        }
        // chlidList
        else {
          forEach.call(m.removedNodes, downgrade);
          forEach.call(m.addedNodes, upgrade);
        }
      });
    });

    this.observer.observe(root, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeOldValue: true
    });
  }

  _upgradeAttr(attrName) {
    var document = this.ownerDocument;
    var matches = document.querySelectorAll("[" + attrName + "]");
    for(var match of matches) {
      this._found(attrName, match);
    }
  }

  _upgradeElement(element) {
    if(element.nodeType !== 1) return;

    for(var attr of element.attributes) {
      if(this._getConstructor(attr.name)) {
        this._found(attr.name, element);
      }
    }
  }

  _downgrade(element) {
    var map = this._elementMap.get(element);
    if(!map) return;

    for(var inst of map.values()) {
      if(inst.disconnectedCallback) {
        inst.disconnectedCallback();
      }
    }

    this._elementMap.delete(element);
  }

  _found(attrName, el, oldVal) {
    var map = this._elementMap.get(el);
    if(!map) {
      map = new Map();
      this._elementMap.set(el, map);
    }

    var inst = map.get(attrName);
    var newVal = el.getAttribute(attrName);
    if(!inst) {
      var Constructor = this._getConstructor(attrName);
      inst = new Constructor();
      map.set(attrName, inst);
      inst.ownerElement = el;
      inst.name = attrName;
      inst.value = newVal;
      if(inst.connectedCallback) {
        inst.connectedCallback();
      }
    }
    // Attribute was removed
    else if(newVal == null && !!inst.value) {
      inst.value = newVal;
      if(inst.disconnectedCallback) {
        inst.disconnectedCallback();
      }

      map.delete(attrName);
    }
    // Attribute changed
    else if(newVal !== inst.value) {
      inst.value = newVal;
      if(inst.changedCallback) {
        inst.changedCallback(oldVal, newVal);
      }
    }

  }
}

window.customAttributes = new CustomAttributeRegistry(document);
})();
