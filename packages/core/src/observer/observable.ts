/**
 * Copyright 2026-present Termlnk
 *
 * Licensed under the PolyForm Noncommercial License 1.0.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     https://polyformproject.org/licenses/noncommercial/1.0.0
 *
 * Use of this software for any commercial purpose is prohibited.
 * The software is provided "AS IS", WITHOUT WARRANTY OR CONDITION OF ANY KIND,
 * either express or implied. See the License for the specific language
 * governing permissions and limitations under the License.
 */

import type { Observer as RxObserver, Subscription } from 'rxjs';
import { Observable, Subject } from 'rxjs';

/**
 * Mediates between an observable and its observers; carries per-emit state
 * (skip-next, last-return-value, stop-propagation) that observers can mutate.
 */
export class EventState {
  /**
   * Set to true to skip every subsequent observer on the current emit.
   */
  skipNextObservers = false;

  /**
   * Return value of the most recent observer; seeded with the event itself.
   */
  lastReturnValue?: unknown;

  isStopPropagation: boolean = false;

  stopPropagation() {
    this.isStopPropagation = true;
  }
}

interface INotifyObserversReturn {
  /** If the event has been handled by any event handler. */
  handled: boolean;
  lastReturnValue: unknown;
  stopPropagation: boolean;
}

export interface IEventObserver<T> extends Partial<RxObserver<[T, EventState]>> {
  next?: (value: [T, EventState]) => unknown;

  priority?: number;
}

/**
 * RxJS Subject extended with priority-ordered observers and per-emit
 * `EventState` so handlers can short-circuit or stop propagation.
 */
export class EventSubject<T> extends Subject<[T, EventState]> {
  private _sortedObservers: IEventObserver<T>[] = [];

  override unsubscribe(): void {
    super.unsubscribe();
    this._sortedObservers.length = 0;
  }

  override complete(): void {
    super.complete();
    this._sortedObservers.length = 0;
  }

  subscribeEvent(observer: IEventObserver<T> | ((evt: T, state: EventState) => unknown)): Subscription {
    let ob: IEventObserver<T>;
    if (typeof observer === 'function') {
      ob = { next: ([evt, state]: [T, EventState]) => observer(evt, state) };
    } else {
      ob = observer;
    }

    const subscription = super.subscribe(ob);
    this._sortedObservers.push(ob);
    this._sortedObservers.sort((a, b) => (a.priority ?? 0) - (b.priority ?? 0));

    subscription.add(() => this._sortedObservers = this._sortedObservers.filter((o) => o !== ob));
    return subscription;
  }

  clearObservers(): void {
    this._sortedObservers.forEach((observer) => observer.complete?.());
    this._sortedObservers.length = 0;
  }

  emitEvent(event: T): INotifyObserversReturn {
    if (!this.closed) {
      const state = new EventState();
      state.lastReturnValue = event;

      for (const observer of this._sortedObservers) {
        const value = observer.next?.([event, state]);
        state.lastReturnValue = value;

        if (state.skipNextObservers) {
          return {
            handled: true,
            lastReturnValue: state.lastReturnValue,
            stopPropagation: state.isStopPropagation,
          };
        }
      }

      return {
        handled: this._sortedObservers.length > 0,
        lastReturnValue: state.lastReturnValue,
        stopPropagation: state.isStopPropagation,
      };
    }

    throw new Error('[EventSubject]: cannot emit event on a closed subject.');
  }
}

export function fromEventSubject<T>(subject$: EventSubject<T>) {
  return new Observable<T>((subscriber) => {
    const ob = subject$.subscribeEvent((evt) => {
      subscriber.next(evt);
    });
    return () => ob.unsubscribe();
  });
}
