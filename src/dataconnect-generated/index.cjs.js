const { queryRef, executeQuery, mutationRef, executeMutation, validateArgs } = require('firebase/data-connect');

const connectorConfig = {
  connector: 'example',
  service: 'ai-link-mcp-server',
  location: 'us-east4'
};
exports.connectorConfig = connectorConfig;

const createUserRef = (dc) => {
  const { dc: dcInstance} = validateArgs(connectorConfig, dc, undefined);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'CreateUser');
}
createUserRef.operationName = 'CreateUser';
exports.createUserRef = createUserRef;

exports.createUser = function createUser(dc) {
  return executeMutation(createUserRef(dc));
};

const listStrategiesRef = (dc) => {
  const { dc: dcInstance} = validateArgs(connectorConfig, dc, undefined);
  dcInstance._useGeneratedSdk();
  return queryRef(dcInstance, 'ListStrategies');
}
listStrategiesRef.operationName = 'ListStrategies';
exports.listStrategiesRef = listStrategiesRef;

exports.listStrategies = function listStrategies(dc) {
  return executeQuery(listStrategiesRef(dc));
};

const updateStrategyRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'UpdateStrategy', inputVars);
}
updateStrategyRef.operationName = 'UpdateStrategy';
exports.updateStrategyRef = updateStrategyRef;

exports.updateStrategy = function updateStrategy(dcOrVars, vars) {
  return executeMutation(updateStrategyRef(dcOrVars, vars));
};

const getPortfolioSnapshotsRef = (dc) => {
  const { dc: dcInstance} = validateArgs(connectorConfig, dc, undefined);
  dcInstance._useGeneratedSdk();
  return queryRef(dcInstance, 'GetPortfolioSnapshots');
}
getPortfolioSnapshotsRef.operationName = 'GetPortfolioSnapshots';
exports.getPortfolioSnapshotsRef = getPortfolioSnapshotsRef;

exports.getPortfolioSnapshots = function getPortfolioSnapshots(dc) {
  return executeQuery(getPortfolioSnapshotsRef(dc));
};
