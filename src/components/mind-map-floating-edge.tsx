"use client";

import {
  BaseEdge,
  getStraightPath,
  useInternalNode,
  type EdgeProps,
  type InternalNode,
  type Node,
} from "@xyflow/react";

function getNodeIntersection(
  intersectionNode: InternalNode<Node>,
  targetNode: InternalNode<Node>,
) {
  const w = (intersectionNode.measured.width ?? 0) / 2;
  const h = (intersectionNode.measured.height ?? 0) / 2;
  if (w === 0 || h === 0) return null;

  const x2 = intersectionNode.internals.positionAbsolute.x + w;
  const y2 = intersectionNode.internals.positionAbsolute.y + h;
  const x1 =
    targetNode.internals.positionAbsolute.x + (targetNode.measured.width ?? 0) / 2;
  const y1 =
    targetNode.internals.positionAbsolute.y + (targetNode.measured.height ?? 0) / 2;

  const xx1 = (x1 - x2) / (2 * w) - (y1 - y2) / (2 * h);
  const yy1 = (x1 - x2) / (2 * w) + (y1 - y2) / (2 * h);
  const denom = Math.abs(xx1) + Math.abs(yy1);
  if (denom === 0) return { x: x2, y: y2 };
  const a = 1 / denom;
  const xx3 = a * xx1;
  const yy3 = a * yy1;
  return { x: w * (xx3 + yy3) + x2, y: h * (-xx3 + yy3) + y2 };
}

export function FloatingEdge({ id, source, target, style }: EdgeProps) {
  const sourceNode = useInternalNode(source);
  const targetNode = useInternalNode(target);
  if (!sourceNode || !targetNode) return null;

  const sourcePoint = getNodeIntersection(sourceNode, targetNode);
  const targetPoint = getNodeIntersection(targetNode, sourceNode);
  if (!sourcePoint || !targetPoint) return null;

  const [path] = getStraightPath({
    sourceX: sourcePoint.x,
    sourceY: sourcePoint.y,
    targetX: targetPoint.x,
    targetY: targetPoint.y,
  });

  return <BaseEdge id={id} path={path} style={style} />;
}
