import { useState } from "preact/hooks";

export default function HomePage() {
	const [count, setCount] = useState(0);

	return (
		<div>
			<h1>Hello, world!</h1>
			<p>Count: {count}</p>
			<button onClick={() => setCount((c) => c + 1)}>Increment</button>
		</div>
	);
}
