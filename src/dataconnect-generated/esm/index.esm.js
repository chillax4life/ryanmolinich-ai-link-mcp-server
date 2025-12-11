import { queryRef, executeQuery, mutationRef, executeMutation, validateArgs } from 'firebase/data-connect';

export const connectorConfig = {
  connector: 'example',
  service: 'ai-link-mcp-server',
  location: 'us-east4'
};

export const createUserRef = (dc) => {
  const { dc: dcInstance} = validateArgs(connectorConfig, dc, undefined);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'CreateUser');
}
createUserRef.operationName = 'CreateUser';

export function createUser(dc) {
  return executeMutation(createUserRef(dc));
}

export const listStrategiesRef = (dc) => {
  const { dc: dcInstance} = validateArgs(connectorConfig, dc, undefined);
  dcInstance._useGeneratedSdk();
  return queryRef(dcInstance, 'ListStrategies');
}
listStrategiesRef.operationName = 'ListStrategies';

export function listStrategies(dc) {
  return executeQuery(listStrategiesRef(dc));
}

export const updateStrategyRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'UpdateStrategy', inputVars);
}
updateStrategyRef.operationName = 'UpdateStrategy';

export function updateStrategy(dcOrVars, vars) {
  return executeMutation(updateStrategyRef(dcOrVars, vars));
}

export const getPortfolioSnapshotsRef = (dc) => {
  const { dc: dcInstance} = validateArgs(connectorConfig, dc, undefined);
  dcInstance._useGeneratedSdk();
  return queryRef(dcInstance, 'GetPortfolioSnapshots');
}
getPortfolioSnapshotsRef.operationName = 'GetPortfolioSnapshots';

export function getPortfolioSnapshots(dc) {
  return executeQuery(getPortfolioSnapshotsRef(dc));
}

