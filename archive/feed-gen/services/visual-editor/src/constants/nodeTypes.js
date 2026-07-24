/**
 * Node Type Registry
 * Maps node type IDs to their React components
 */

import StartNode from '../nodes/StartNode'
import EndNode from '../nodes/EndNode'
import ContainerInNode from '../nodes/ContainerInNode'
import ContainerOutNode from '../nodes/ContainerOutNode'
import GroupNode from '../nodes/GroupNode'
import LogicContainerNode from '../nodes/LogicContainerNode'
import JunctionNode from '../nodes/JunctionNode'
import ConditionNode from '../nodes/ConditionNode'
import ManualPostsNode from '../nodes/ManualPostsNode'
import ScoringNode from '../nodes/ScoringNode'
import InjectionNode from '../nodes/InjectionNode'
import SortingNode from '../nodes/SortingNode'
import AccessNode from '../nodes/AccessNode'
import FixedPositionNode from '../nodes/FixedPositionNode'
import FixedSortingNode from '../nodes/FixedSortingNode'
import VideoFeedNode from '../nodes/VideoFeedNode'

export const nodeTypes = {
  start: StartNode,
  containerin: ContainerInNode,
  manualposts: ManualPostsNode,
  end: EndNode,
  containerout: ContainerOutNode,
  and: GroupNode,
  or: GroupNode,
  nof: GroupNode,
  logicgroup: GroupNode,
  logicbox: LogicContainerNode,
  junction: JunctionNode,
  text: ConditionNode,
  regex: ConditionNode,
  language: ConditionNode,
  posttype: ConditionNode,
  hashtag: ConditionNode,
  labels: ConditionNode,
  dateage: ConditionNode,
  engagement: ConditionNode,
  poststructure: ConditionNode,
  mentions: ConditionNode,
  links: ConditionNode,
  image: ConditionNode,
  video: ConditionNode,
  author: ConditionNode,
  media: ConditionNode,
  quotepost: ConditionNode,
  recency: ScoringNode,
  engagementscore: ScoringNode,
  customscore: ScoringNode,
  rotatingposts: InjectionNode,
  feedads: InjectionNode,
  pinnedposts: FixedPositionNode,
  dynamicpinned: FixedPositionNode,
  featuredpost: FixedPositionNode,
  fixedchronological: FixedSortingNode,
  fixedbyscore: FixedSortingNode,
  fixedmostlikes: FixedSortingNode,
  fixedmostengagement: FixedSortingNode,
  fixedrandom: FixedSortingNode,
  chronological: SortingNode,
  byscore: SortingNode,
  mostlikes: SortingNode,
  mostengagement: SortingNode,
  random: SortingNode,
  whitelist: AccessNode,
  videofeed: VideoFeedNode,
}
