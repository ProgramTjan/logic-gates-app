export function createChipsFactory(deps) {
  const { allocateId, getChipDefinition, normalizeNode, deepClone, normalizeWorkspaceMeta } = deps;

  function createWorkspace(project, name, source, metaOverrides) {
    if (source) {
      return {
        id: allocateId(project, "ws"),
        name,
        nodes: deepClone(source.nodes).map(normalizeNode),
        wires: deepClone(source.wires),
        createdAt: new Date().toISOString(),
        meta: {
          ...normalizeWorkspaceMeta(source.meta),
          ...normalizeWorkspaceMeta(metaOverrides),
        },
      };
    }
    return {
      id: allocateId(project, "ws"),
      name,
      nodes: [],
      wires: [],
      createdAt: new Date().toISOString(),
      meta: normalizeWorkspaceMeta(metaOverrides),
    };
  }

  function createChipInstance(project, definitionId, position) {
    const definition =
      (project && Array.isArray(project.chipDefinitions)
        ? project.chipDefinitions.find((item) => item.id === definitionId)
        : null) || getChipDefinition(definitionId);
    return normalizeNode({
      id: allocateId(project, "node"),
      type: "chip-instance",
      x: position && typeof position.x === "number" ? position.x : 180,
      y: position && typeof position.y === "number" ? position.y : 160,
      config: {
        definitionId,
        label: definition ? `${definition.name} v${definition.version}` : "Chip",
      },
    });
  }

  return { createWorkspace, createChipInstance };
}
