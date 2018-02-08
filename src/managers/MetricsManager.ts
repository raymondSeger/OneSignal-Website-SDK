import * as objectAssign from 'object-assign';
import { base64Encode } from '../utils/Encoding';
import Environment from '../Environment';

abstract class MetricEvent {
  abstract getEventName();
  getPropertiesAsJson() {
    /* Origin and URL are available from the service worker as well */
    return {
      origin: location.origin,
      url: location.href,
      sdkVersion: Environment.version()
    }
  }
}

abstract class MetricEngagement {
  abstract getProfileName();
  abstract getOperationData();
}

export enum ApiUsageMetricKind {
  HttpPermissionRequest = 'HttpPermissionRequest'
}

export class ApiUsageMetricEvent extends MetricEvent {
  constructor(public apiName: ApiUsageMetricKind) {
    super();
  }

  getEventName() {
    return 'api-usage';
  }

  getPropertiesAsJson() {
    return objectAssign({}, {
      api: this.apiName.toString(),
    }, super.getPropertiesAsJson());
  }
}

export class PageViewMetricEngagement extends MetricEngagement {
  constructor() {
    super();
  }

  getProfileName() {
    return "all_websites";
  }

  getDateUtc() {
    const date = new Date();
    return `${date.getUTCMonth() + 1}_${date.getUTCDate()}_${date.getUTCFullYear()}`;
  }

  getOperationData() {
    const payload = {
      $add: {

      },
      $ignore_time: true
    };

    payload[`$add`][`pageview_${this.getDateUtc()}`] = 1;

    return payload;
  }
}

export default class MetricsManager {
  private isFeatureEnabled: boolean;
  private mixpanelReportingToken: string;

  constructor(isFeatureEnabled: boolean, mixpanelReportingToken: string) {
    this.isFeatureEnabled = isFeatureEnabled;
    this.mixpanelReportingToken = mixpanelReportingToken;
  }

  static get MIXPANEL_REPORTING_URL() {
    return 'https://api.mixpanel.com';
  }

  isEnabled(): boolean {
    return this.isFeatureEnabled && !!this.mixpanelReportingToken;
  }

  reportEvent(event: MetricEvent) {
    if (!this.isEnabled()) {
      return Promise.resolve(null);
    }

    const queryParamsData = {
      event: event.getEventName(),
      properties: objectAssign({}, {
        token: this.mixpanelReportingToken,
      }, event.getPropertiesAsJson())
    };
    const queryParams = base64Encode(JSON.stringify(queryParamsData));

    const requestOptions = {
      method: 'GET',
      headers: new Headers(),
      cache: 'no-cache',
    };

    return fetch(`${MetricsManager.MIXPANEL_REPORTING_URL}/track/?data=${queryParams}`, requestOptions);
  }

  reportEngagement(engagement: MetricEngagement) {
    if (!this.isEnabled()) {
      return Promise.resolve(null);
    }

    let queryParamsData = {
      $token: this.mixpanelReportingToken,
      $distinct_id: engagement.getProfileName(),
    };
    queryParamsData = objectAssign({}, queryParamsData, engagement.getOperationData());
    const queryParams = base64Encode(JSON.stringify(queryParamsData));

    const requestOptions = {
      method: 'GET',
      headers: new Headers(),
      cache: 'no-cache',
    };

    return fetch(`${MetricsManager.MIXPANEL_REPORTING_URL}/engage/?data=${queryParams}`, requestOptions);
  }

  reportPageView() {
    const date = new Date();
    // Collect for one week from feature release date
    const shouldCollectPageView = (
      (date.getUTCMonth() + 1) <= 2 &&
      date.getUTCDate() <= 11 &&
      date.getUTCFullYear() <= 2018
    );
    if (shouldCollectPageView) {
      this.reportEngagement(new PageViewMetricEngagement());
    }
  }
}
