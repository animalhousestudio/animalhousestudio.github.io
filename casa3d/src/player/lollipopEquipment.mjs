// Session-only inventory. Visibility leaves the authored hand pose, cup and
// attachment transforms untouched, including when collection precedes loading.
export function createLollipopEquipment({ matches = node => node.name === 'ATTACH_L_Lollipop_Grip' || node.name.startsWith('PROP_L_Lollipop_') } = {}) {
  let equipped = false;
  let suppressed = false;
  let attachments = [];
  const apply = () => { for (const node of attachments) node.visible = equipped && !suppressed; };
  return {
    get equipped() { return equipped; },
    attach(root) {
      attachments = [];
      root.traverse(node => {
        if (matches(node)) attachments.push(node);
      });
      apply();
      return attachments.length;
    },
    collect() {
      if (equipped) return false;
      equipped = true; apply();
      return true;
    },
    setSuppressed(value) { suppressed = Boolean(value); apply(); },
  };
}
