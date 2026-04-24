import { Enum } from "cc";

export enum Direction {
  Up = 0,
  Right = 1,
  Down = 2,
  Left = 3,
}

Enum(Direction);

const directions = [
  Direction.Up,
  Direction.Right,
  Direction.Down,
  Direction.Left,
];

export function randomDirection(previous?: Direction) {
  if (previous === undefined) {
    return directions[Math.floor(Math.random() * directions.length)];
  }

  let next = previous;
  while (next === previous) {
    next = directions[Math.floor(Math.random() * directions.length)];
  }
  return next;
}

export function oppositeOf(direction: Direction) {
  switch (direction) {
    case Direction.Up:
      return Direction.Down;
    case Direction.Right:
      return Direction.Left;
    case Direction.Down:
      return Direction.Up;
    case Direction.Left:
      return Direction.Right;
    default:
      return Direction.Left;
  }
}

export function directionToAngle(direction: Direction) {
  switch (direction) {
    case Direction.Up:
      return 90;
    case Direction.Right:
      return 0;
    case Direction.Down:
      return -90;
    case Direction.Left:
      return 180;
    default:
      return 0;
  }
}

export function directionToVector(direction: Direction) {
  switch (direction) {
    case Direction.Up:
      return { x: 0, y: 1 };
    case Direction.Right:
      return { x: 1, y: 0 };
    case Direction.Down:
      return { x: 0, y: -1 };
    case Direction.Left:
      return { x: -1, y: 0 };
    default:
      return { x: 1, y: 0 };
  }
}

export function directionToText(direction: Direction) {
  switch (direction) {
    case Direction.Up:
      return "Up";
    case Direction.Right:
      return "Right";
    case Direction.Down:
      return "Down";
    case Direction.Left:
      return "Left";
    default:
      return "Unknown";
  }
}
