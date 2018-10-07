import { NetInfo, AsyncStorage } from "react-native";

import { eventChannel, delay } from "redux-saga"
import { call, put, race, take } from "redux-saga/effects"

/**
 * Constructs a Saga channel that allows users
 * to be notified whenever network state changes.
 *
 * @param syncActionName
 */
function * startChannel(syncActionName) {
  const channel = eventChannel(listener => {
    const handleConnectivityChange = (isConnected) => {
      listener(isConnected);
    }

    NetInfo.isConnected.addEventListener("connectionChange", handleConnectivityChange);
    return () => NetInfo.isConnected.removeEventListener("connectionChange", handleConnectivityChange);
  });

  // Listen for the changes and put action
  while (true) {
    const connectionInfo = yield take(channel);
    yield put({type: syncActionName, status: connectionInfo }); // blocking action
  }
}

/**
 * Delays calling sync until the app is ready for it.
 * This allows apps to "throttle" calling sync until after an initial loading,
 * according to the user's choice so that they are not interrupted too soon.
 *
 * @param interval Number of seconds to delay calling sync
 * @param action Name of a Redux action to wait for being dispatched before calling sync.
 */
function* delayNetworkStatus(interval, action) {
  const networkStatusDelayKey = "NETWORK_STATUS_DELAY_KEY";
  const key = yield call(AsyncStorage.getItem, networkStatusDelayKey);

  if (!key) {
    yield call(AsyncStorage.setItem, networkStatusDelayKey, "VALUE");

    let events = {
      interval: call(delay, interval * 1000)
    };

    // Based on delay action
    if (action) {
      events.action = take(action);
    }
    yield race(events);
  }
}

/**
 * Redux Saga that handles synchronizing a React Native
 * app with the CodePush server at configurable events.
 *
 * @param options Options to configure when to call sync.
 */
export default function* netInfoSaga(options = {}) {
  options = {
    syncAction: 'CONNECTION_STATUS',

    delayByInterval: 0,
    delayByAction: null,

    ...options
  };

  // Check if user has specified a delay
  if (options.delayByInterval > 0 || options.delayByAction) {
    yield call(delayNetworkStatus, options.delayByInterval, options.delayByAction);
  }

  try {
    yield call(startChannel, options.syncAction);
  } catch (e) {
    console.log(e);
  }
}
