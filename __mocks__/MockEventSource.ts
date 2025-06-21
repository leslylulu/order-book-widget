
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
		// for testing cleanup behavior
		this.dispatchEvent(new Event('close'));
	});

	constructor(url: string) {
		this.url = url;
		// TODO deal with withCredentials?
		setTimeout(() => {
			this.readyState = this.OPEN;
			if (this.onopen) {
				this.onopen(new Event('open'));
			}
		}, 10)
	}
	
	addEventListener(
		type: string,
		listener: EventListenerOrEventListenerObject,
	): void {
		if (!this.eventListeners[type]) {
			this.eventListeners[type] = []
		}
		this.eventListeners[type].push(listener as (event: Event) => void);
	}
	removeEventListener(type: string, listener: EventListenerOrEventListenerObject): void {
		if (this.eventListeners[type]) {
			this.eventListeners[type] = this.eventListeners[type].filter(l => l !== listener);
		}
	}
	// dispatchEvent need return boolean
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

	emitMessage(data: any) {
		const messageEvent = new MessageEvent('message', {
			data: typeof data === 'string' ? data : JSON.stringify(data),
			origin: this.url
		})
		this.dispatchEvent(messageEvent);
	}

	emitError(error: any = new Error('mock error')) {
		const errorEvent = new Event('error') as Event;
		(errorEvent as any).error = error;
		this.dispatchEvent(errorEvent);
	}

	emitReconnect(): void {
		this.readyState = this.CLOSED;
		this.emitError(new Error('connection lost'));

		setTimeout(() => {
			this.readyState = this.OPEN;
			this.dispatchEvent(new Event('open'))
		}, 50);
	}
	
}


export default MockEventSource;
