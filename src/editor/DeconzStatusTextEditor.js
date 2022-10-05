class DeconzStatusTextEditor extends DeconzEditor {
  constructor(node, options = {}) {
    super(
      node,
      $.extend(
        {
          allowedTypes: ["msg", "jsonata"],
        },
        options
      )
    );
  }

  get elements() {
    return {
      statustext: "node-input-statustext",
    };
  }

  async init(mainEditor) {
    await super.init();
    this.mainEditor = mainEditor;
    this.initTypedInput();
  }

  initTypedInput() {
    let options = [];
    if (this.mainEditor.options.have.statustext) {
      options.push({
        value: "auto",
        label: RED._(
          `${this.NRCD}/server:editor.inputs.statustext.options.auto`
        ),
        icon: `icons/${this.NRCD}/icon-color.png`,
        hasValue: false,
      });
    }

    // Init typed input
    this.$elements.statustext.typedInput({
      type: "auto",
      types: options.concat(this.options.allowedTypes),
      typeField: `#${this.elements.statustext}_type`,
    });
  }
}
