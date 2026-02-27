const io = require("socket.io")(process.env.PORT || 3000, {
  cors: { origin: "*" } 
});

let worldStates = {};

io.on("connection", (socket) => {
  console.log("Player connected:", socket.id);

  socket.on("joinWorld", (worldId) => {
    socket.join(worldId);
    if (!worldStates[worldId]) worldStates[worldId] = { players: {}, world: null, worldSurface: null, chestData: {}, host: socket.id };
    
    worldStates[worldId].players[socket.id] = { x: 0, y: 0, hp: 100, equip: [], activeItem: null, dir: 1, swingAnim: 0 };

    if (worldStates[worldId].world && worldStates[worldId].host !== socket.id) {
        // Send the map AND the chests to late joiners
        socket.emit("worldData", { world: worldStates[worldId].world, worldSurface: worldStates[worldId].worldSurface, chestData: worldStates[worldId].chestData });
    }

    io.to(worldId).emit("updatePlayers", worldStates[worldId].players);
  });

  socket.on("hostWorld", (data) => {
    if (worldStates[data.worldId]) {
        worldStates[data.worldId].world = data.world;
        worldStates[data.worldId].worldSurface = data.worldSurface;
        worldStates[data.worldId].chestData = data.chestData || {};
        socket.to(data.worldId).emit("worldData", { world: data.world, worldSurface: data.worldSurface, chestData: worldStates[data.worldId].chestData });
    }
  });

  // NEW: Sync individual chest slots when a player moves an item
  socket.on("chestUpdate", (data) => {
    if (worldStates[data.worldId]) {
        if (!worldStates[data.worldId].chestData) worldStates[data.worldId].chestData = {};
        if (!worldStates[data.worldId].chestData[data.chestKey]) worldStates[data.worldId].chestData[data.chestKey] = [];
        
        worldStates[data.worldId].chestData[data.chestKey][data.index] = data.slotData;
        socket.to(data.worldId).emit("chestUpdated", data);
    }
  });

  socket.on("blockUpdate", (data) => {
    if (worldStates[data.worldId] && worldStates[data.worldId].world) {
        worldStates[data.worldId].world[data.x][data.y] = data.id;
        socket.to(data.worldId).emit("blockUpdated", data); 
    }
  });

  socket.on("playerUpdate", (data) => {
    const { worldId, x, y, equip, activeItem, dir, swingAnim } = data;
    if (worldStates[worldId] && worldStates[worldId].players[socket.id]) {
      worldStates[worldId].players[socket.id] = { x, y, equip, activeItem, dir, swingAnim };
      socket.to(worldId).emit("playerUpdated", { id: socket.id, x, y, equip, activeItem, dir, swingAnim, hitEvents: data.hitEvents });
    }
  });

  socket.on("syncEntities", (data) => {
      socket.to(data.worldId).emit("entitiesSynced", data);
  });

  socket.on("spawnProjectile", (data) => {
      socket.to(data.worldId).emit("spawnProjectile", data);
  });

  socket.on("disconnect", () => {
    for (let worldId in worldStates) {
      if (worldStates[worldId].players[socket.id]) {
        delete worldStates[worldId].players[socket.id];
        io.to(worldId).emit("updatePlayers", worldStates[worldId].players);
        
        if (worldStates[worldId].host === socket.id) {
            let keys = Object.keys(worldStates[worldId].players);
            if (keys.length > 0) worldStates[worldId].host = keys[0];
            else delete worldStates[worldId]; 
        }
      }
    }
  });
});
