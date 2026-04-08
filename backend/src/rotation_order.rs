//! Ordre d’affichage des rotations : plongée 1 puis 2, puis sans classement ; `number` en tie-break.

use crate::entities::rotations;
use std::cmp::Ordering;

pub fn sort_rotations(mut list: Vec<rotations::Model>) -> Vec<rotations::Model> {
    list.sort_by(|a, b| {
        match (a.plongee_number, b.plongee_number) {
            (None, None) => a.number.cmp(&b.number),
            (None, Some(_)) => Ordering::Less,
            (Some(_), None) => Ordering::Greater,
            (Some(pa), Some(pb)) => pa.cmp(&pb).then(a.number.cmp(&b.number)),
        }
    });
    list
}
