import '@testing-library/jest-dom';

interface EventSourceMessageEvent extends Event {
	data: string;
	lastEventId?: string;
	origin: string;
}

type EventHandler = ((event: Event) => void) | null;

class MockEventSource implements EventSource {
	static readonly CONNECTING = 0;
	static readonly OPEN = 1;
	static readonly CLOSED = 2;

	readonly CONNECTING = MockEventSource.CONNECTING;
	readonly OPEN = MockEventSource.OPEN;
	readonly CLOSED = MockEventSource.CLOSED;

	url: string;
	// TODO deal with withCredentials
	withCredentials: boolean = false;
	readyState: number = this.CONNECTING;

	onopen: EventHandler = null;
	onmessage: ((event: EventSourceMessageEvent) => void) | null = null;
	onerror: EventHandler = null;

	private eventListeners: Record<string, Array<(event: Event) => void>> = {
		open: [],
		message: [],
		error: []
	};

	close = jest.fn(() => {
		this.readyState = this.CLOSED;
		this.dispatchEvent(new Event('close'));
	});

	constructor(url: string) {
		this.url = url;
		setTimeout(() => {
			this.readyState = this.OPEN;
			if (this.onopen) {
				this.onopen(new Event('open'));
			}
		}, 10);
	}

	addEventListener(
		type: string,
		listener: EventListenerOrEventListenerObject,
	): void {
		if (typeof listener === 'function') {
			if (!this.eventListeners[type]) {
				this.eventListeners[type] = [];
			}
			this.eventListeners[type].push(listener as (event: Event) => void);
		}
	}

	removeEventListener(type: string, listener: EventListenerOrEventListenerObject): void {
		if (typeof listener === 'function' && this.eventListeners[type]) {
			this.eventListeners[type] = this.eventListeners[type].filter(l => l !== listener);
		}
	}

	dispatchEvent(event: Event): boolean {
		const listeners = this.eventListeners[event.type] || [];

		listeners.forEach(listener => {
			try {
				listener(event);
			} catch (error) {
				console.error(`Error in event listener for ${event.type}:`, error);
			}
		});

		if (event.type === 'open' && this.onopen) {
			this.onopen(event);
		} else if (event.type === 'message' && this.onmessage) {
			this.onmessage(event as EventSourceMessageEvent);
		} else if (event.type === 'error' && this.onerror) {
			this.onerror(event);
		}

		return !event.defaultPrevented;
	}

	emitMessage(data: any): void {
		const messageEvent = new Event('message') as EventSourceMessageEvent;
		messageEvent.data = typeof data === 'string' ? data : JSON.stringify(data);
		messageEvent.origin = this.url;

		this.dispatchEvent(messageEvent);
	}

	emitError(error: Error = new Error('mock error')): void {
		const errorEvent = new Event('error');
		(errorEvent as any).error = error;

		this.dispatchEvent(errorEvent);
	}

	emitServerMessage(price: number): void {
		const data = JSON.stringify({ price });
		const messageEvent = new Event('message') as EventSourceMessageEvent;
		messageEvent.data = data;
		messageEvent.origin = this.url;

		this.dispatchEvent(messageEvent);
	}
}

global.EventSource = MockEventSource as any;

export default MockEventSource;